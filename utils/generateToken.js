import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const generateAccessToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

const generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
    });
};

const generateRandomToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

export {
    generateAccessToken,
    generateRefreshToken,
    generateRandomToken
}; // Named exports