// import 'dotenv/config'; // ES Module way to load environment variables
// import express from 'express';
// // import cors from 'cors'; // REMOVED as no frontend is integrated
// import { prisma } from './config/db.js'; // Note the .js extension for local imports
// import authRoutes from './routes/auth.js'; // Note the .js extension

// const app = express();

// // Middleware
// app.use(express.json()); // Allows us to get data in req.body

// // --- ADDED GENERAL REQUEST LOGGER ---
// app.use((req, res, next) => {
//     console.log(`Incoming Request: ${req.method} ${req.url}`);
//     console.log('Request Body:', req.body);
//     // console.log('Request Headers:', req.headers); // Uncomment if you need to inspect headers closely
//     next();
// });
// // --- END ADDED GENERAL REQUEST LOGGER ---

// // No CORS configuration as no frontend is integrated yet
// // If you integrate a frontend later, you'll need to re-add and configure `cors` here.

// // Routes
// app.use('/api/auth', authRoutes);

// // Basic unprotected route for testing
// app.get('/', (req, res) => {
//     res.send('Auth Backend is running!');
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).send('Something broke!');
// });

// const PORT = process.env.PORT || 4000;

// app.listen(PORT, async () => {
//     try {
//         await prisma.$connect(); // Connect to the database when server starts
//         console.log('Prisma connected to database!');
//         console.log(`Server running on port ${PORT}`);
//     } catch (error) {
//         console.error('Failed to connect to database:', error);
//         process.exit(1); // Exit if DB connection fails
//     }
// });

// // Disconnect Prisma client when the application closes
// process.on('beforeExit', async () => {
//     await prisma.$disconnect();
// });






import 'dotenv/config'; // ES Module way to load environment variables
import express from 'express';
import cors from 'cors'; // RE-ADDED CORS
import { prisma } from './config/db.js'; // Note the .js extension for local imports
import authRoutes from './routes/auth.js'; // Note the .js extension

const app = express();

// Middleware
app.use(express.json()); // Allows us to get data in req.body

// --- RE-ADDED CORS CONFIGURATION ---
// This allows requests from your React frontend (localhost:3000)
// For development, `origin: '*'` is often used but less secure.
// It's better to explicitly allow your frontend's origin.
app.use(cors({
    origin: 'http://localhost:5173', // Allow requests from your React development server
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
    credentials: true, // Allow cookies and authorization headers
}));
// --- END RE-ADDED CORS CONFIGURATION ---

// --- ADDED GENERAL REQUEST LOGGER ---
app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    console.log('Request Body:', req.body);
    // console.log('Request Headers:', req.headers); // Uncomment if you need to inspect headers closely
    next();
});
// --- END ADDED GENERAL REQUEST LOGGER ---


// Routes
app.use('/api/auth', authRoutes);

// Basic unprotected route for testing
app.get('/', (req, res) => {
    res.send('Auth Backend is running!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 4000; // Confirming it's 4000

app.listen(PORT, async () => {
    try {
        await prisma.$connect(); // Connect to the database when server starts
        console.log('Prisma connected to database!');
        console.log(`Server running on port ${PORT}`);
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1); // Exit if DB connection fails
    }
});

// Disconnect Prisma client when the application closes
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});