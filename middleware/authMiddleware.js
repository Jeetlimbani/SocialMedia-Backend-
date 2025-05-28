import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js'; // Note the .js extension

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    isActive: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    bio: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            if (!req.user.isActive) {
                return res.status(403).json({ message: 'Account not activated. Please check your email.' });
            }

            next();
        } catch (error) {
            console.error(error);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired. Please log in again.' });
            }
            // For other JWT errors like JsonWebTokenError (invalid signature), etc.
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        // You would need a 'role' field in your User schema for this to work
        next();
    };
};

export { protect, authorize }; // Named exports