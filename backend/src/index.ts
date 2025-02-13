import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import logger from 'morgan';
import MongoStore from 'connect-mongo';
import { MongoClient } from 'mongodb';
import env from './environments';
import mountPaymentsEndpoints from './handlers/payments';
import mountUserEndpoints from './handlers/users';

// Import type definitions (required for ts-node-dev to detect changes)
import "./types/session";

// Use the API URL if provided, otherwise fallback to local connection
const dbName = env.mongo_db_name;
const mongoUri = env.mongo_api_url || `mongodb://${env.mongo_host}/${dbName}`;

// Configure client options:
// If you are connecting through an API URL (such as MongoDB Atlas), 
// the credentials are typically embedded in the URL, so you might not need to specify them here.
const mongoClientOptions: any = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // Uncomment these if your API URL does not include credentials:
  // authSource: "admin",
  // auth: {
  //   username: env.mongo_user,
  //   password: env.mongo_password,
  // },
};

const app: express.Application = express();

// Log requests to the console in a compact format:
app.use(logger('dev'));

// Full log of all requests to /log/access.log:
app.use(logger('common', {
  stream: fs.createWriteStream(path.join(__dirname, '..', 'log', 'access.log'), { flags: 'a' }),
}));

// Enable JSON response bodies:
app.use(express.json());

// Handle CORS:
app.use(cors({
  origin: env.frontend_url,
  credentials: true,
}));

// Handle cookies:
app.use(cookieParser());

// Set up sessions:
app.use(session({
  secret: env.session_secret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    mongoOptions: mongoClientOptions,
    dbName: dbName,
    collectionName: 'user_sessions'
  }),
}));

// Mount Payments endpoints under /payments:
const paymentsRouter = express.Router();
mountPaymentsEndpoints(paymentsRouter);
app.use('/payments', paymentsRouter);

// Mount User endpoints (e.g., signin, signout) under /user:
const userRouter = express.Router();
mountUserEndpoints(userRouter);
app.use('/user', userRouter);

// A simple hello world endpoint:
app.get('/', async (_, res) => {
  res.status(200).send({ message: "Hello, World!" });
});

// Boot up the app:
// Boot up the app:
app.listen(8000, async () => {
  try {
    // Create a new MongoClient instance
    const client = new MongoClient(mongoUri, mongoClientOptions);
    
    // Connect the client to the server
    await client.connect();
    
    // Get the database
    const db = client.db(dbName);
    
    // Set up collections on the app locals
    app.locals.orderCollection = db.collection('orders');
    app.locals.userCollection = db.collection('users');
    
    console.log('Connected to MongoDB on: ', mongoUri);
  } catch (err) {
    console.error('Connection to MongoDB failed: ', err);
  }

  console.log('App platform demo app - Backend listening on port 8000!');
  console.log(`CORS config: configured to respond to a frontend hosted on ${env.frontend_url}`);
});

