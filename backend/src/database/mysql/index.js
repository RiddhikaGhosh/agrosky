const mysql = require('mysql2/promise');
const mysqlConfig = require('../../config/mysql.config');
const { logger } = require('../../utils/logger');
const { DatabaseError } = require('../../utils/apiError');

let pool = null;

/**
 * Returns or initializes the MySQL connection pool
 */
const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(mysqlConfig);
  }
  return pool;
};

/**
 * Executes a parameterized SQL query against MySQL operational database
 *
 * @param {string} sql - Parameterized SQL query string
 * @param {Array} params - Array of query parameters
 * @param {Object} [customConn] - Optional connection instance (for transaction scope)
 */
const query = async (sql, params = [], customConn = null) => {
  const runner = customConn || getPool();
  try {
    const [rows] = await runner.execute(sql, params);
    return rows;
  } catch (error) {
    logger.error(`MySQL Operational Query Error: ${error.message}`);
    const dbError = new DatabaseError(`Database operation failed: ${error.message}`, 'MYSQL_ERROR');
    dbError.code = error.code;
    dbError.errno = error.errno;
    dbError.sqlState = error.sqlState;
    throw dbError;
  }
};

/**
 * Connection Health Checker
 */
const testConnection = async () => {
  try {
    const connectionPool = getPool();
    const connection = await connectionPool.getConnection();
    logger.info('MySQL Operational Database health check PASSED');
    connection.release();
    return true;
  } catch (error) {
    logger.warn(`MySQL Operational DB Warning (DB offline or credentials pending): ${error.message}`);
    return false;
  }
};

/**
 * Graceful Connection Shutdown
 */
const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('MySQL connection pool cleanly terminated.');
  }
};

const { withTransaction } = require('./transaction');

module.exports = {
  getPool,
  query,
  testConnection,
  closePool,
  withTransaction
};
