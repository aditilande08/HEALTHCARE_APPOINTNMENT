const express = require('express');
const controller = require('../controllers/doctorController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// search and profile are open to any authenticated user
router.use(authenticate);

router.get('/', controller.searchDoctors);

router.get('/:doctorId', controller.getDoctorProfile);

// returns available time slots for a given date
// GET /api/doctors/:doctorId/slots?date=2024-12-20
router.get('/:doctorId/slots', controller.getAvailableSlots);

module.exports = router;
