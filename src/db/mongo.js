const { MongoClient } = require('mongodb');
const config = require('../config');

let db;
let client;

async function connectMongo() {
  if (db) return db; // Cache hit untuk Vercel Serverless

  client = new MongoClient(config.MONGODB_URI);
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
