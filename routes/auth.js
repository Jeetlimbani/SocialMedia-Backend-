// import express from 'express';
// import bcrypt from 'bcryptjs';
// import { body, validationResult } from 'express-validator';

// import { prisma } from '../config/db.js';
// import { sendEmail } from '../utils/emailService.js';
// // generateRefreshToken is imported again here
// import { generateAccessToken, generateRefreshToken, generateRandomToken } from '../utils/generateToken.js';
// import { protect } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // Helper to calculate token expiry (1 hour from now for activation/reset, dynamic for refresh)
// const getExpiryDate = (hours) => {
//     const date = new Date();
//     date.setHours(date.getHours() + hours);
//     return date;
// };

// // Helper to calculate token expiry from days
// const getExpiryDateInDays = (days) => {
//     const date = new Date();
//     date.setDate(date.getDate() + days);
//     return date;
// };

// // @route   POST /api/auth/register
// // @desc    Register user & send activation email
// // @access  Public
// router.post(
//     '/register',
//     [
//         body('username')
//             .isAlphanumeric()
//             .withMessage('Username must be alphanumeric.')
//             .isLength({ min: 3 })
//             .withMessage('Username must be at least 3 characters long.'),
//         body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
//         body('password')
//             .isLength({ min: 8 })
//             .withMessage('Password must be at least 8 characters long.')
//             .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
//             .withMessage('Password must include uppercase, lowercase, number, and a symbol.'),
//         body('confirmPassword').custom((value, { req }) => {
//             if (value !== req.body.password) {
//                 throw new Error('Password confirmation does not match password.');
//             }
//             return true;
//         })
//     ],
//     async (req, res) => {
//         // --- ADDED LOGS ---
//         console.log('----- Inside /api/auth/register route handler -----');
//         console.log('Request body inside route:', req.body);
//         // --- END ADDED LOGS ---

//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             console.log('Validation Errors:', errors.array());
//             return res.status(400).json({ errors: errors.array() });
//         }

//         const { username, email, password } = req.body;

//         try {
//             console.log('Attempting to find existing user...');
//             const existingUser = await prisma.user.findFirst({
//                 where: {
//                     OR: [{ email: email }, { username: username }]
//                 }
//             });

//             if (existingUser) {
//                 console.log('User already exists:', existingUser.email);
//                 if (existingUser.email === email) {
//                     return res.status(400).json({ message: 'Email already registered.' });
//                 }
//                 if (existingUser.username === username) {
//                     return res.status(400).json({ message: 'Username already taken.' });
//                 }
//             }

//             console.log('Hashing password...');
//             const salt = await bcrypt.genSalt(10);
//             const hashedPassword = await bcrypt.hash(password, salt);

//             console.log('Generating activation token...');
//             const activationToken = generateRandomToken();
//             const activationTokenExpires = getExpiryDate(1); // 1 hour

//             console.log('Creating new user in database...');
//             const user = await prisma.user.create({
//                 data: {
//                     username,
//                     email,
//                     password: hashedPassword,
//                     isActive: false,
//                     activationToken,
//                     activationTokenExpires,
//                     createdAt: new Date(),
//                     updatedAt: new Date()
//                 }
//             });
//             console.log('User created:', user.id);

//             // Removed FRONTEND_URL as no frontend is integrated yet
//             const activationLinkPlaceholder = `Please use this token: ${activationToken} on your frontend's activation page.`;
//             const emailContent = `
//                 <p>Hello ${user.username},</p>
//                 <p>Thank you for registering. Please click the link below to activate your account:</p>
//                 <p>${activationLinkPlaceholder}</p>
//                 <p>This token will expire in 1 hour.</p>
//                 <p>If you did not register, please ignore this email.</p>
//             `;

//             console.log('Sending activation email...');
//             await sendEmail(user.email, 'Account Activation', emailContent);

//             res.status(201).json({ message: 'Registration successful! Please check your email to activate your account.' });

//         } catch (err) {
//             console.error('Server Error in /register:', err.message);
//             res.status(500).send('Server Error');
//         }
//     }
// );

// // @route   POST /api/auth/activate
// // @desc    Activate user account
// // @access  Public
// router.post('/activate', async (req, res) => {
//     const { token } = req.body;

//     if (!token) {
//         return res.status(400).json({ message: 'Activation token is missing.' });
//     }

//     try {
//         const user = await prisma.user.findFirst({
//             where: {
//                 activationToken: token,
//                 isActive: false,
//                 activationTokenExpires: {
//                     gt: new Date()
//                 }
//             }
//         });

//         if (!user) {
//             return res.status(400).json({ message: 'Invalid or expired activation link or account already active.' });
//         }

//         await prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 isActive: true,
//                 activationToken: null,
//                 activationTokenExpires: null,
//                 updatedAt: new Date()
//             }
//         });

//         res.status(200).json({ message: 'Account activated successfully! You can now log in.' });

//     } catch (err) {
//         console.error(err.message);
//         res.status(500).send('Server Error');
//     }
// });


// // @route   POST /api/auth/login
// // @desc    Authenticate user & get token
// // @access  Public
// router.post( '/login',
//     [
//         body('identifier').notEmpty().withMessage('Username or email is required.'),
//         body('password').notEmpty().withMessage('Password is required.')
//     ],
//     async (req, res) => {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }

//         const { identifier, password } = req.body;

//         try {
//             const user = await prisma.user.findFirst({
//                 where: {
//                     OR: [{ email: identifier }, { username: identifier }]
//                 }
//             });

//             if (!user) {
//                 return res.status(400).json({ message: 'Invalid credentials.' });
//             }

//             if (!user.isActive) {
//                 return res.status(403).json({ message: 'Account not active. Please check your email for activation link.' });
//             }

//             const isMatch = await bcrypt.compare(password, user.password);

//             if (!isMatch) {
//                 return res.status(400).json({ message: 'Invalid credentials.' });
//             }

//             const accessToken = generateAccessToken(user.id);
//             const newRefreshToken = generateRefreshToken(user.id); // Generate refresh token
//             const refreshTokenExpires = getExpiryDateInDays(parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN.replace('d', ''))); // Parse days from env

//             // Store the new refresh token and its expiry in the database for the user
//             await prisma.user.update({
//                 where: { id: user.id },
//                 data: {
//                     refreshToken: newRefreshToken,
//                     refreshTokenExpires: refreshTokenExpires,
//                     lastLoginAt: new Date(),
//                     updatedAt: new Date()
//                 }
//             });

//             res.json({
//                 message: 'Login successful!',
//                 token: accessToken,
//                 refreshToken: newRefreshToken, // Include refresh token in response
//                 user: {
//                     id: user.id,
//                     username: user.username,
//                     email: user.email,
//                     isActive: user.isActive,
//                     firstName: user.firstName,
//                     lastName: user.lastName,
//                     avatar: user.avatar,
//                     bio: user.bio
//                 }
//             });

//         } catch (err) {
//             console.error(err.message);
//             res.status(500).send('Server Error');
//         }
//     }
// );

// // @route   POST /api/auth/forgot-password
// // @desc    Send password reset link to user's email
// // @access  Public
// router.post('/forgot-password', async (req, res) => {
//     const { email } = req.body;

//     try {
//         const user = await prisma.user.findUnique({ where: { email } });

//         if (!user) {
//             return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
//         }

//         const resetPasswordToken = generateRandomToken();
//         const resetPasswordExpires = getExpiryDate(1); // 1 hour

//         await prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 resetPasswordToken,
//                 resetPasswordExpires,
//                 updatedAt: new Date()
//             }
//         });

//         // Removed FRONTEND_URL as no frontend is integrated yet
//         const resetLinkPlaceholder = `Please use this token: ${resetPasswordToken} on your frontend's password reset page.`;
//         const emailContent = `
//             <p>Hello ${user.username},</p>
//             <p>You have requested to reset your password. Please use the token below to set a new password:</p>
//             <p>${resetLinkPlaceholder}</p>
//             <p>This token will expire in 1 hour.</p>
//             <p>If you did not request a password reset, please ignore this email.</p>
//         `;

//         await sendEmail(user.email, 'Password Reset Request', emailContent);

//         res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

//     } catch (err) {
//         console.error(err.message);
//         res.status(500).send('Server Error');
//     }
// });

// // @route   POST /api/auth/reset-password
// // @desc    Reset user password using token
// // @access  Public
// router.post('/reset-password',
//     [
//         body('token').notEmpty().withMessage('Reset token is missing.'),
//         body('newPassword')
//             .isLength({ min: 8 })
//             .withMessage('Password must be at least 8 characters long.')
//             .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
//             .withMessage('Password must include uppercase, lowercase, number, and a symbol.'),
//         body('confirmNewPassword').custom((value, { req }) => {
//             if (value !== req.body.newPassword) {
//                 throw new Error('Password confirmation does not match new password.');
//             }
//             return true;
//         })
//     ],
//     async (req, res) => {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }

//         const { token, newPassword } = req.body;

//         try {
//             const user = await prisma.user.findFirst({
//                 where: {
//                     resetPasswordToken: token,
//                     resetPasswordExpires: {
//                         gt: new Date()
//                     }
//                 }
//             });

//             if (!user) {
//                 return res.status(400).json({ message: 'Invalid or expired password reset link.' });
//             }

//             const salt = await bcrypt.genSalt(10);
//             const hashedPassword = await bcrypt.hash(newPassword, salt);

//             await prisma.user.update({
//                 where: { id: user.id },
//                 data: {
//                     password: hashedPassword,
//                     resetPasswordToken: null,
//                     resetPasswordExpires: null,
//                     updatedAt: new Date()
//                 }
//             });

//             res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });

//         } catch (err) {
//             console.error(err.message);
//             res.status(500).send('Server Error');
//         }
//     }
// );

// // @route   POST /api/auth/logout
// // @desc    Log out user (invalidate refresh token)
// // @access  Protected (requires valid access token to identify user)
// router.post('/logout', protect, async (req, res) => {
//     try {
//         // Invalidate the refresh token in the database
//         // req.user is available from the 'protect' middleware
//         if (req.user && req.user.id) {
//             await prisma.user.update({
//                 where: { id: req.user.id },
//                 data: {
//                     refreshToken: null,
//                     refreshTokenExpires: null,
//                     updatedAt: new Date()
//                 }
//             });
//             res.status(200).json({ message: 'Logged out successfully.' });
//         } else {
//             res.status(400).json({ message: 'User not identified for logout.' });
//         }
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).send('Server Error');
//     }
// });


// // @route   GET /api/auth/me
// // @desc    Get current logged in user (example of protected route)
// // @access  Private
// router.get('/me', protect, async (req, res) => {
//     try {
//         // req.user is populated by the protect middleware
//         res.json(req.user);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).send('Server Error');
//     }
// });


// export default router;





import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';

import { prisma } from '../config/db.js';
import { sendEmail } from '../utils/emailService.js';
import { generateAccessToken, generateRefreshToken, generateRandomToken } from '../utils/generateToken.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper to calculate token expiry (1 hour from now for activation/reset, dynamic for refresh)
const getExpiryDate = (hours) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date;
};

// Helper to calculate token expiry from days
const getExpiryDateInDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
};

// @route   POST /api/auth/register
// @desc    Register user & send activation email
// @access  Public
router.post(
    '/register',
    [
        body('username')
            .isAlphanumeric()
            .withMessage('Username must be alphanumeric.')
            .isLength({ min: 3 })
            .withMessage('Username must be at least 3 characters long.'),
        body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long.')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
            .withMessage('Password must include uppercase, lowercase, number, and a symbol.'),
        body('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password confirmation does not match password.');
            }
            return true;
        })
    ],
    async (req, res) => {
        console.log('----- Inside /api/auth/register route handler -----');
        console.log('Request body inside route:', req.body);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation Errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password } = req.body;

        try {
            console.log('Attempting to find existing user...');
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [{ email: email }, { username: username }]
                }
            });

            if (existingUser) {
                console.log('User already exists:', existingUser.email);
                if (existingUser.email === email) {
                    return res.status(400).json({ message: 'Email already registered.' });
                }
                if (existingUser.username === username) {
                    return res.status(400).json({ message: 'Username already taken.' });
                }
            }

            console.log('Hashing password...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            console.log('Generating activation token...');
            const activationToken = generateRandomToken();
            const activationTokenExpires = getExpiryDate(1); // 1 hour

            console.log('Creating new user in database...');
            const user = await prisma.user.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    isActive: false,
                    activationToken,
                    activationTokenExpires,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });
            console.log('User created:', user.id);

            // --- MODIFICATION HERE: Use FRONTEND_URL for clickable link ---
            // Ensure process.env.FRONTEND_URL is set in your .env file (e.g., http://localhost:3000)
            if (!process.env.FRONTEND_URL) {
                console.error('FRONTEND_URL is not defined in .env! Activation link will be incomplete.');
            }
            const activationLink = `${process.env.FRONTEND_URL}/activate?token=${activationToken}`;

            const emailContent = `
                <p>Hello ${user.username},</p>
                <p>Thank you for registering. Please click the link below to activate your account:</p>
                <p><a href="${activationLink}">Activate My Account</a></p>
                <p>If the link above doesn't work, copy and paste this URL into your browser:</p>
                <p>${activationLink}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not register, please ignore this email.</p>
            `;
            // --- END MODIFICATION ---

            console.log('Sending activation email...');
            await sendEmail(user.email, 'Account Activation', emailContent);

            res.status(201).json({ message: 'Registration successful! Please check your email to activate your account.' });

        } catch (err) {
            console.error('Server Error in /register:', err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   POST /api/auth/activate
// @desc    Activate user account
// @access  Public
router.post('/activate', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Activation token is missing.' });
    }

    try {
        const user = await prisma.user.findFirst({
            where: {
                activationToken: token,
                isActive: false,
                activationTokenExpires: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired activation link or account already active.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isActive: true,
                activationToken: null,
                activationTokenExpires: null,
                updatedAt: new Date()
            }
        });

        res.status(200).json({ message: 'Account activated successfully! You can now log in.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
    '/login',
    [
        body('identifier').notEmpty().withMessage('Username or email is required.'),
        body('password').notEmpty().withMessage('Password is required.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier, password } = req.body;

        try {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [{ email: identifier }, { username: identifier }]
                }
            });

            if (!user) {
                return res.status(400).json({ message: 'Invalid credentials.' });
            }

            if (!user.isActive) {
                return res.status(403).json({ message: 'Account not active. Please check your email for activation link.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials.' });
            }

            const accessToken = generateAccessToken(user.id);
            const newRefreshToken = generateRefreshToken(user.id);
            const refreshTokenExpires = getExpiryDateInDays(parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN.replace('d', '')));

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    refreshToken: newRefreshToken,
                    refreshTokenExpires: refreshTokenExpires,
                    lastLoginAt: new Date(),
                    updatedAt: new Date()
                }
            });

            res.json({
                message: 'Login successful!',
                token: accessToken,
                refreshToken: newRefreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isActive: user.isActive,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar,
                    bio: user.bio
                }
            });

        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset link to user's email
// @access  Public
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const resetPasswordToken = generateRandomToken();
        const resetPasswordExpires = getExpiryDate(1); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken,
                resetPasswordExpires,
                updatedAt: new Date()
            }
        });

        // --- MODIFICATION HERE: Use FRONTEND_URL for clickable link ---
        // Ensure process.env.FRONTEND_URL is set in your .env file (e.g., http://localhost:3000)
        if (!process.env.FRONTEND_URL) {
            console.error('FRONTEND_URL is not defined in .env! Reset link will be incomplete.');
        }
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;

        const emailContent = `
            <p>Hello ${user.username},</p>
            <p>You have requested to reset your password. Please click the link below to set a new password:</p>
            <p><a href="${resetLink}">Reset My Password</a></p>
            <p>If the link above doesn't work, copy and paste this URL into your browser:</p>
            <p>${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
        `;
        // --- END MODIFICATION ---

        await sendEmail(user.email, 'Password Reset Request', emailContent);

        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset user password using token
// @access  Public
router.post(
    '/reset-password',
    [
        body('token').notEmpty().withMessage('Reset token is missing.'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long.')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
            .withMessage('Password must include uppercase, lowercase, number, and a symbol.'),
        body('confirmNewPassword').custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match new password.');
            }
            return true;
        })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, newPassword } = req.body;

        try {
            const user = await prisma.user.findFirst({
                where: {
                    resetPasswordToken: token,
                    resetPasswordExpires: {
                        gt: new Date()
                    }
                }
            });

            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired password reset link.' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordExpires: null,
                    updatedAt: new Date()
                }
            });

            res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });

        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   POST /api/auth/logout
// @desc    Log out user (invalidate refresh token)
// @access  Protected (requires valid access token to identify user)
router.post('/logout', protect, async (req, res) => {
    try {
        // Invalidate the refresh token in the database
        // req.user is available from the 'protect' middleware
        if (req.user && req.user.id) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: {
                    refreshToken: null,
                    refreshTokenExpires: null,
                    updatedAt: new Date()
                }
            });
            res.status(200).json({ message: 'Logged out successfully.' });
        } else {
            res.status(400).json({ message: 'User not identified for logout.' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET /api/auth/me
// @desc    Get current logged in user (example of protected route)
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        // req.user is populated by the protect middleware
        res.json(req.user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


export default router;