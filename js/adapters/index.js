/**
 * @description Barrel export for adapters
 */
const DataAdapter = require("./DataAdapter");
const InMemoryAdapter = require("./InMemoryAdapter");
const FilesystemAdapter = require("./FilesystemAdapter");
const RedisAdapter = require("./RedisAdapter");
const GunDBAdapter = require("./GunDBAdapter");

module.exports = {
	DataAdapter,
	InMemoryAdapter,
	FilesystemAdapter,
	RedisAdapter,
	GunDBAdapter,
};
