const mysqlIndex = require('./index');
const { logger } = require('../../utils/logger');

/**
 * Executes a callback function within an isolated MySQL transaction block.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK upon error.
 *
 * @param {Function} callback - Async function receiving (connection) parameter
 */
const withTransaction = async (callback) => {
  const pool = mysqlIndex.getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Execute parameterized queries within connection transaction scope
    const result = await callback(connection);
    
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error(`Transaction rolled back due to error: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  withTransaction
};
