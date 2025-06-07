import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    try {
      console.log('Initializing database connection...');
      db = await Database.load('sqlite:inventory.db');
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }
  return db;
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const database = await getDatabase();
    // Test with a simple query
    const result = await database.select('SELECT 1 as test');
    console.log('Database test result:', result);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}