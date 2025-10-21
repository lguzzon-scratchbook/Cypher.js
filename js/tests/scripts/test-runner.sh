#!/bin/bash

# Test Runner Script for Cypher.js
# =================================
# Unified test execution with Redis lifecycle management
# Supports filtered test runs and CI/CD integration

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$TESTS_DIR/../.." && pwd)"
REDIS_MANAGER="$SCRIPT_DIR/redisManager.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Redis state tracking
REDIS_STARTED_BY_SCRIPT=false

# Usage information
usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --adapter <name>    Run tests for specific adapter (redis, inmemory, filesystem, gundb, all)"
  echo "  --no-redis          Skip Redis startup (assumes Redis already running)"
  echo "  --keep-redis        Keep Redis running after tests"
  echo "  --verbose           Show detailed test output"
  echo "  --help              Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                          # Run all tests with Redis management"
  echo "  $0 --adapter redis          # Run only Redis adapter tests"
  echo "  $0 --no-redis               # Run tests without starting Redis"
  echo "  $0 --keep-redis             # Keep Redis running after tests"
  exit 0
}

# Parse command line arguments
ADAPTER="all"
NO_REDIS=false
KEEP_REDIS=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --adapter)
      ADAPTER="$2"
      shift 2
      ;;
    --no-redis)
      NO_REDIS=true
      shift
      ;;
    --keep-redis)
      KEEP_REDIS=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_test_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Testing: $1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

# Cleanup function
cleanup() {
  if [ "$REDIS_STARTED_BY_SCRIPT" = true ] && [ "$KEEP_REDIS" = false ]; then
    log_info "Stopping Redis server..."
    bash "$REDIS_MANAGER" stop || log_warning "Failed to stop Redis"
  fi
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Start Redis if needed
start_redis_if_needed() {
  if [ "$NO_REDIS" = true ]; then
    log_info "Skipping Redis startup (--no-redis flag)"
    return 0
  fi

  log_info "Checking Redis status..."
  
  # Check if Redis is already running
  if bash "$REDIS_MANAGER" health quiet > /dev/null 2>&1; then
    log_success "Redis is already running"
    return 0
  fi

  log_info "Starting Redis server..."
  if bash "$REDIS_MANAGER" start; then
    REDIS_STARTED_BY_SCRIPT=true
    log_success "Redis started successfully"
    
    # Wait for Redis to be ready
    sleep 2
    
    # Verify Redis is healthy
    if bash "$REDIS_MANAGER" health quiet > /dev/null 2>&1; then
      log_success "Redis health check passed"
      return 0
    else
      log_error "Redis health check failed"
      return 1
    fi
  else
    log_error "Failed to start Redis"
    return 1
  fi
}

# Run a single test file
run_test() {
  local test_file="$1"
  local test_name="$2"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  log_test_header "$test_name"
  
  if [ ! -f "$test_file" ]; then
    log_warning "Test file not found: $test_file"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    return 0
  fi
  
  # Run the test
  if [ "$VERBOSE" = true ]; then
    if node "$test_file"; then
      log_success "✓ $test_name passed"
      PASSED_TESTS=$((PASSED_TESTS + 1))
      return 0
    else
      log_error "✗ $test_name failed"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
  else
    # Capture output and only show on failure
    local output
    if output=$(node "$test_file" 2>&1); then
      log_success "✓ $test_name passed"
      PASSED_TESTS=$((PASSED_TESTS + 1))
      return 0
    else
      log_error "✗ $test_name failed"
      echo "$output"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
  fi
}

# Print test summary
print_summary() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  Test Summary${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo -e "Total Tests:   $TOTAL_TESTS"
  echo -e "${GREEN}Passed:        $PASSED_TESTS${NC}"
  if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed:        $FAILED_TESTS${NC}"
  else
    echo -e "Failed:        $FAILED_TESTS"
  fi
  if [ $SKIPPED_TESTS -gt 0 ]; then
    echo -e "${YELLOW}Skipped:       $SKIPPED_TESTS${NC}"
  fi
  echo -e "${BLUE}========================================${NC}"
  echo ""
  
  if [ $FAILED_TESTS -eq 0 ] && [ $PASSED_TESTS -gt 0 ]; then
    log_success "All tests passed! 🎉"
    return 0
  elif [ $FAILED_TESTS -gt 0 ]; then
    log_error "Some tests failed!"
    return 1
  else
    log_warning "No tests were run"
    return 1
  fi
}

# Main test execution
main() {
  log_info "Cypher.js Test Runner"
  log_info "Adapter filter: $ADAPTER"
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed or not in PATH"
    exit 1
  fi
  
  # Test base adapter interface (always run unless specific adapter is selected and it's not inmemory)
  if [ "$ADAPTER" = "all" ] || [ "$ADAPTER" = "inmemory" ]; then
    run_test "$TESTS_DIR/adapters.test.js" "DataAdapter Interface (InMemoryAdapter)"
  fi
  
  # Test Redis adapter
  if [ "$ADAPTER" = "all" ] || [ "$ADAPTER" = "redis" ]; then
    # Start Redis if needed
    if ! start_redis_if_needed; then
      log_error "Cannot run Redis tests without Redis server"
      if [ "$ADAPTER" = "redis" ]; then
        exit 1
      fi
      SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    else
      # Check for new location first, fall back to old location
      if [ -f "$TESTS_DIR/adapters/redis.test.js" ]; then
        run_test "$TESTS_DIR/adapters/redis.test.js" "RedisAdapter"
      else
        run_test "$TESTS_DIR/redis.test.js" "RedisAdapter"
      fi
    fi
  fi
  
  # Test InMemory adapter (if separate test exists)
  if [ "$ADAPTER" = "all" ] || [ "$ADAPTER" = "inmemory" ]; then
    if [ -f "$TESTS_DIR/adapters/inmemory.test.js" ]; then
      run_test "$TESTS_DIR/adapters/inmemory.test.js" "InMemoryAdapter (Extended)"
    fi
  fi
  
  # Test Filesystem adapter
  if [ "$ADAPTER" = "all" ] || [ "$ADAPTER" = "filesystem" ]; then
    if [ -f "$TESTS_DIR/adapters/filesystem.test.js" ]; then
      run_test "$TESTS_DIR/adapters/filesystem.test.js" "FilesystemAdapter"
    else
      run_test "$TESTS_DIR/filesystem.test.js" "FilesystemAdapter"
    fi
  fi
  
  # Test GunDB adapter
  if [ "$ADAPTER" = "all" ] || [ "$ADAPTER" = "gundb" ]; then
    if [ -f "$TESTS_DIR/adapters/gundb.test.js" ]; then
      run_test "$TESTS_DIR/adapters/gundb.test.js" "GunDBAdapter"
    else
      run_test "$TESTS_DIR/gundb.test.js" "GunDBAdapter"
    fi
  fi
  
  # Run integration tests (only if adapter is "all")
  if [ "$ADAPTER" = "all" ]; then
    if [ -f "$TESTS_DIR/integration/integration.test.js" ]; then
      run_test "$TESTS_DIR/integration/integration.test.js" "Integration Tests"
    elif [ -f "$TESTS_DIR/integration.test.js" ]; then
      run_test "$TESTS_DIR/integration.test.js" "Integration Tests"
    fi
    
    # Run query execution tests
    if [ -f "$TESTS_DIR/query/query-execution.test.js" ]; then
      run_test "$TESTS_DIR/query/query-execution.test.js" "Query Execution Tests"
    elif [ -f "$TESTS_DIR/query-execution.test.js" ]; then
      run_test "$TESTS_DIR/query-execution.test.js" "Query Execution Tests"
    fi
  fi
  
  # Print summary and exit
  print_summary
  exit $?
}

# Run main function
main
