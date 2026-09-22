const { MongoClient } = require('mongodb');
const config = require('../config');

let db;

async function connectMongo() {
  const client = new MongoClient(config.MONGODB_URI);
  await client.connect();
  db = client.db();

  await db.collection('users').createIndex({ telegramId: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ reffId: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ telegramId: 1, createdAt: -1 });
  await db.collection('reports').createIndex({ reportedTelegramId: 1 });
  await db.collection('reports').createIndex({ action: 1 });

  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected');
  return db;
}

const users = () => getDb().collection('users');
const transactions = () => getDb().collection('transactions');
const reports = () => getDb().collection('reports');

module.exports = { connectMongo, getDb, users, transactions, reports };
