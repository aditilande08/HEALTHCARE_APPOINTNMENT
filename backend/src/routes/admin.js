const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/adminController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// all admin routes require authentication + ADMIN role
router.use(authenticate, authorize('ADMIN'));

// ─── Doctor management ────────────────────────────────────────────────────────

router.get('/doctors', controller.getDoctors);

router.get('/doctors/:doctorId', controller.getDoctor);

router.post(
  '/doctors',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('specialisation').trim().notEmpty().withMessage('Specialisation is required'),
    body('slotDuration')
      .optional()
      .isInt({ min: 10, max: 120 })
      .withMessage('Slot duration must be between 10 and 120 minutes'),
    body('workingHours').optional().isObject().withMessage('workingHours must be an object'),
  ],
  controller.createDoctor
);

router.patch('/doctors/:doctorId', controller.updateDoctor);

router.delete('/doctors/:doctorId', controller.deleteDoctor);

// ─── Leave management ─────────────────────────────────────────────────────────

router.get('/doctors/:doctorId/leaves', controller.getLeaves);

router.post(
  '/doctors/:doctorId/leaves',
  [
    body('date').isISO8601().withMessage('date must be a valid ISO date (YYYY-MM-DD)'),
    body('reason').optional().trim(),
  ],
  controller.addLeave
);

router.delete(
  '/doctors/:doctorId/leaves/:date',
  [param('date').isISO8601().withMessage('date must be a valid ISO date')],
  controller.removeLeave
);

module.exports = router;
