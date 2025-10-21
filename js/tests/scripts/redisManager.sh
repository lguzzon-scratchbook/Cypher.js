#!/bin/bash

# Redis Docker Manager Script
# ===========================
# This script provides end-to-end management for a Redis server running in a Docker container.
# It handles starting, stopping, restarting, status checks, and data resets with persistence options.
# Designed for production-grade reliability, with error handling, logging, and idempotency.

# Configurable Section
# ====================
# Modify these variables to customize the script's behavior.
CONTAINER_NAME="redis-manager"     # Name of the Docker container
REDIS_IMAGE="redis:latest"         # Docker image for Redis
HOST_PORT=6379                     # Host port to bind Redis to
CONTAINER_PORT=6379                # Internal Redis port (usually 6379)
DEFAULT_DATA_DIR="/tmp/redis-data" # Default temporary data directory (auto-cleaned on reset)
LOG_FILE="/tmp/redis-manager.log"  # Path to the log file for audits (user-writable)
REDIS_PASSWORD=""                  # Optional Redis password (leave empty for none)
NETWORK="bridge"                   # Docker network mode (e.g., bridge, host)

# Ensure the script is run with bash
if [ -z "$BASH_VERSION" ]; then
  echo "Error: This script must be run with bash." >&2
  exit 1
fi

# Internal Variables (Do not modify)
SCRIPT_NAME=$(basename "$0")
TEMP_BACKUP_DIR="/tmp/redis-backup-$(date +%Y%m%d%H%M%S)"

# Logging Function
# ================
# Logs messages to LOG_FILE and stdout with timestamp.
log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Error Handling and Exit
# =======================
# Exits with a code and logs the error.
error_exit() {
  log "ERROR" "$1"
  exit "${2:-1}"
}

# Signal Trapping
# ===============
# Traps signals for graceful shutdown and cleanup.
trap 'log "INFO" "Signal received. Gracefully shutting down."; cleanup; exit 0' INT TERM
cleanup() {
  log "INFO" "Starting cleanup process..."

  # Stop the Redis container if it's running
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    log "INFO" "Stopping Redis container during cleanup..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || log "WARNING" "Failed to stop container during cleanup"
    docker rm "$CONTAINER_NAME" 2>/dev/null || log "WARNING" "Failed to remove container during cleanup"
  fi

  # Clean up temporary backup directories
  if [ -n "$TEMP_BACKUP_DIR" ] && [ -d "$TEMP_BACKUP_DIR" ]; then
    log "INFO" "Removing temporary backup directory: $TEMP_BACKUP_DIR"
    rm -rf "$TEMP_BACKUP_DIR" || log "WARNING" "Failed to remove temporary backup directory"
  fi

  # Remove any orphaned volumes or networks created by this script
  docker volume ls -q --filter "name=$CONTAINER_NAME" | xargs -r docker volume rm 2>/dev/null || true

  # Clean up lock files or PID files if they exist
  local lock_file="/tmp/${SCRIPT_NAME}.lock"
  [ -f "$lock_file" ] && rm -f "$lock_file"

  # Flush any remaining log buffers
  sync

  log "INFO" "Cleanup completed successfully."
}

# Prerequisite Validation
# =======================
# Checks for Docker installation, port availability, and resource adequacy.
validate_prerequisites() {
  if ! command -v docker &>/dev/null; then
    error_exit "Docker is not installed or not in PATH."
  fi

  # Check if port is available
  if ss -tuln | grep -q ":$HOST_PORT "; then
    error_exit "Port $HOST_PORT is already in use."
  fi

  # Basic resource check (e.g., ensure at least 512MB free memory)
  free_mem=$(free -m | awk '/Mem:/ {print $4}')
  if [ "$free_mem" -lt 512 ]; then
    error_exit "Insufficient free memory (less than 512MB available)."
  fi

  # Ensure log directory and file are writable
  LOG_DIR=$(dirname "$LOG_FILE")
  if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR" || error_exit "Failed to create log directory: $LOG_DIR"
  fi
  touch "$LOG_FILE" || error_exit "Cannot write to log file: $LOG_FILE"

  log "INFO" "Prerequisites validated successfully."
}

# Sanitize Input
# ==============
# Basic sanitization to prevent injection (escapes special characters).
sanitize() {
  printf '%q' "$1"
}

# Get Connection String
# =====================
# Returns the Redis connection string based on configuration.
get_connection_string() {
  local host="localhost"
  local port="$HOST_PORT"
  local password_part=""
  [ -n "$REDIS_PASSWORD" ] && password_part=":$REDIS_PASSWORD@"
  echo "redis://$password_part$host:$port"
}

# Health Check Function
# =====================
# Checks Redis container health with configurable retries and timeout.
health_check() {
  local max_attempts="${1:-10}"
  local timeout="${2:-5}"
  local silent="$([ "$3" = "quiet" ] && echo "true" || echo "false")"
  local attempt=1

  if [ "$silent" != "true" ]; then
    log "INFO" "Starting health verification for Redis container: $CONTAINER_NAME"
  fi

  # First check if container exists and is running
  if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    [ "$silent" != "true" ] && log "WARNING" "Container $CONTAINER_NAME is not running"
    return 1
  fi

  while [ $attempt -le $max_attempts ]; do
    [ "$silent" != "true" ] && log "INFO" "Health check attempt $attempt of $max_attempts"

    # Use timeout to prevent hanging
    if timeout "$timeout" docker exec "$CONTAINER_NAME" redis-cli ping &>/dev/null; then
      local response=$(docker exec "$CONTAINER_NAME" redis-cli ping)
      if [ "$response" = "PONG" ]; then
        [ "$silent" != "true" ] && log "INFO" "Health check successful: Redis responded with PONG"
        return 0
      else
        [ "$silent" != "true" ] && log "WARNING" "Health check failed: Unexpected response '$response'"
      fi
    else
      [ "$silent" != "true" ] && log "WARNING" "Health check failed: PING command timed out or failed"
    fi

    if [ $attempt -lt $max_attempts ]; then
      [ "$silent" != "true" ] && log "INFO" "Waiting 1 second before retry..."
      sleep 1
    fi

    attempt=$((attempt + 1))
  done

  [ "$silent" != "true" ] && log "ERROR" "Health check failed after $max_attempts attempts"
  return 1
}

# Standalone Health Check Command
# ===============================
# Dedicated command to check Redis server health without side effects.
health_command() {
  local quiet="$1" # optional "quiet" flag for script-friendly output

  if health_check 10 5 "$quiet"; then
    if [ "$quiet" = "quiet" ]; then
      echo "healthy"
    else
      echo "✓ Redis is healthy and responding"
      echo "Connection: $(get_connection_string)"
      log "INFO" "Health check completed successfully"
    fi
    return 0
  else
    if [ "$quiet" = "quiet" ]; then
      echo "unhealthy"
    else
      echo "✗ Redis is not responding or container is not running"
      log "ERROR" "Health check failed"
    fi
    return 1
  fi
}

# Highlight Connection String
# ===========================
# Outputs the connection string in a highlighted, visual format.
highlight_connection() {
  local conn_str=$(get_connection_string)
  echo -e "\033[1;32m=====================================\033[0m"
  echo -e "\033[1;32mRedis Connection String:\033[0m \033[1;33m$conn_str\033[0m"
  echo -e "\033[1;32m=====================================\033[0m"
  log "INFO" "Connection string: $conn_str"
}

# Start Container
# ===============
# Launches the Redis container with validation and persistence.
start_container() {
  local data_dir="$1"
  data_dir=$(sanitize "$data_dir")

  validate_prerequisites

  # Handle data directory - ensure it's never empty
  if [ -z "$data_dir" ]; then
    data_dir="$DEFAULT_DATA_DIR"
    log "INFO" "Using default temporary data directory: $data_dir"
  fi

  # Create and set permissions if directory doesn't exist
  if [ ! -d "$data_dir" ]; then
    mkdir -p "$data_dir" || error_exit "Failed to create data directory: $data_dir"
    chmod 755 "$data_dir"
    log "INFO" "Created data directory: $data_dir"
  fi

  # Final validation to ensure data_dir is not empty and is an absolute path
  if [ -z "$data_dir" ] || [ "$data_dir" = "/" ]; then
    error_exit "Data directory cannot be empty or root. Please provide a valid path."
  fi

  # Ensure data_dir is an absolute path to avoid Docker volume mount issues
  if [[ $data_dir != /* ]]; then
    data_dir="$(pwd)/$data_dir"
    log "INFO" "Converted to absolute path: $data_dir"
  fi

  # Check if container already exists (idempotency)
  if docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    log "WARNING" "Container $CONTAINER_NAME already exists. Attempting to start it."
    docker start "$CONTAINER_NAME" || error_exit "Failed to start existing container."
  else
    local cmd="docker run -d --name $CONTAINER_NAME -p $HOST_PORT:$CONTAINER_PORT -v $data_dir:/data"
    [ -n "$REDIS_PASSWORD" ] && cmd="$cmd -e REDIS_PASSWORD=$REDIS_PASSWORD"
    cmd="$cmd --network $NETWORK $REDIS_IMAGE"

    eval "$cmd" || error_exit "Failed to launch container."
    log "INFO" "Container $CONTAINER_NAME launched successfully."
  fi

  # Perform health verification using refactored function
  if ! health_check; then
    log "ERROR" "Redis health verification failed. Terminating container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || log "WARNING" "Failed to stop container during cleanup"
    docker rm "$CONTAINER_NAME" 2>/dev/null || log "WARNING" "Failed to remove container during cleanup"
    error_exit "Redis server health verification failed after maximum retries"
  fi

  highlight_connection
}

# Stop Container
# ==============
# Gracefully stops the container and cleans up.
stop_container() {
  if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    log "WARNING" "Container $CONTAINER_NAME is not running."
    return 0 # Idempotent: no error if already stopped
  fi

  docker stop "$CONTAINER_NAME" || error_exit "Failed to stop container."
  docker rm "$CONTAINER_NAME" || log "WARNING" "Failed to remove container (may require manual cleanup)."
  log "INFO" "Container $CONTAINER_NAME stopped and removed."
}

# Restart Container
# =================
# Restarts the container with minimal downtime.
restart_container() {
  local data_dir="$1"

  stop_container
  start_container "$data_dir"
  log "INFO" "Container $CONTAINER_NAME restarted."
}

# Status Report
# =============
# Provides a structured status report.
status_report() {
  if ! docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo "Status: Container $CONTAINER_NAME does not exist."
    return 0
  fi

  local status=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME")
  local uptime=$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER_NAME")
  local ports=$(docker inspect -f '{{range $p, $conf := .HostConfig.PortBindings}}{{(index $conf 0).HostPort}} -> {{$p}} {{end}}' "$CONTAINER_NAME")
  local volumes=$(docker inspect -f '{{range .HostConfig.Binds}}{{.}}{{end}}' "$CONTAINER_NAME")
  local logs=$(docker logs --tail 5 "$CONTAINER_NAME" 2>&1)

  echo "Container Name: $CONTAINER_NAME"
  echo "Status: $status"
  echo "Uptime: $uptime"
  echo "Ports: $ports"
  echo "Volumes: $volumes"
  echo "Recent Logs:"
  echo "$logs"

  log "INFO" "Status report generated."
}

# Reset Data
# ==========
# Resets persisted data with confirmation and backup.
reset_data() {
  local data_dir="$DEFAULT_DATA_DIR" # Reset only applies to default temp dir

  if [ ! -d "$data_dir" ]; then
    log "WARNING" "Data directory $data_dir does not exist. Nothing to reset."
    return 0
  fi

  # Check if directory is in use (e.g., container running)
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    error_exit "Cannot reset data while container is running. Stop it first."
  fi

  # User confirmation
  read -p "Are you sure you want to reset data in $data_dir? This will back up and delete contents. (y/n): " confirm
  if [[ ! $confirm =~ ^[yY]$ ]]; then
    log "INFO" "Reset cancelled by user."
    return 0
  fi

  # Backup
  mkdir -p "$TEMP_BACKUP_DIR" || error_exit "Failed to create backup directory."
  cp -r "$data_dir/." "$TEMP_BACKUP_DIR" || log "WARNING" "Backup partially failed."
  log "INFO" "Data backed up to $TEMP_BACKUP_DIR"

  # Clear data
  rm -rf "$data_dir"/* || error_exit "Failed to clear data directory."
  log "INFO" "Data in $data_dir reset successfully."
}

# Usage/Help
# ==========
usage() {
  echo "Usage: $SCRIPT_NAME <command> [options]"
  echo "Commands:"
  echo "  start [data_dir]    - Start Redis container (optional: custom data_dir)"
  echo "  stop                - Stop Redis container"
  echo "  restart [data_dir]  - Restart Redis container"
  echo "  status              - Show detailed status report"
  echo "  health [quiet]      - Check Redis server health (use 'quiet' for script output)"
  echo "  reset               - Reset default temporary data (with confirmation)"
  echo "  help                - Show this help"
  echo ""
  echo "Examples:"
  echo "  $SCRIPT_NAME start /path/to/persistent/dir"
  echo "  $SCRIPT_NAME restart"
  echo "  $SCRIPT_NAME health"
  echo "  $SCRIPT_NAME health quiet  # Returns: healthy|unhealthy"
  echo "  $SCRIPT_NAME status"
  exit 0
}

# Main CLI Parsing
# ================
if [ $# -eq 0 ]; then
  usage
fi

command="$1"
shift

case "$command" in
  start)
    start_container "$1"
    ;;
  stop)
    stop_container
    ;;
  restart)
    restart_container "$1"
    ;;
  status)
    status_report
    ;;
  health)
    health_command "$1" # Pass optional "quiet" flag
    ;;
  reset)
    reset_data
    ;;
  help)
    usage
    ;;
  *)
    log "ERROR" "Unknown command: $command"
    usage
    ;;
esac

# Note: Container will remain running after successful start
# Use 'stop' command to clean up when done
