const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/appointmentController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);

// book an appointment — patients only
router.post(
  '/',
  authorize('PATIENT'),
  [
    body('doctorId').notEmpty().withMessage('doctorId is required'),
    body('scheduledAt').isISO8601().withMessage('scheduledAt must be a valid ISO timestamp'),
    body('symptoms').optional().isString().isLength({ max: 2000 }),
  ],
  controller.book
);

// list appointments — filtered by role automatically
router.get('/', controller.list);

// single appointment — access checked in service
router.get('/:appointmentId', controller.get);

// cancel — patient, doctor, or admin can cancel
router.patch(
  '/:appointmentId/cancel',
  authorize('PATIENT', 'DOCTOR', 'ADMIN'),
  controller.cancel
);

// reschedule — patient or admin
router.patch(
  '/:appointmentId/reschedule',
  authorize('PATIENT', 'ADMIN'),
  [body('scheduledAt').isISO8601().withMessage('scheduledAt must be a valid ISO timestamp')],
  controller.reschedule
);

// submit or update symptoms — patient only, triggers LLM pre-visit summary
router.patch(
  '/:appointmentId/symptoms',
  authorize('PATIENT'),
  [body('symptoms').notEmpty().isString().isLength({ max: 2000 })],
  controller.submitSymptoms
);

// post-visit notes + prescription — doctor only, marks appointment COMPLETED
router.patch(
  '/:appointmentId/notes',
  authorize('DOCTOR'),
  [
    body('postVisitNotes').notEmpty().isString().withMessage('postVisitNotes is required'),
    body('prescriptions').optional().isArray().withMessage('prescriptions must be an array'),
    body('prescriptions.*.medication').notEmpty().withMessage('medication is required'),
    body('prescriptions.*.dose').notEmpty().withMessage('dose is required'),
    body('prescriptions.*.frequency').notEmpty().withMessage('frequency is required'),
    body('prescriptions.*.days').isInt({ min: 1 }).withMessage('days must be a positive integer'),
  ],
  controller.submitPostVisitNotes
);

module.exports = router;
