const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  ],
  controller.register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  controller.login
);

router.post('/refresh', controller.refresh);

router.get('/me', authenticate, controller.me);

module.exports = router;
