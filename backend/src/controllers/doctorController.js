const doctorService = require('../services/doctorService');

async function searchDoctors(req, res, next) {
  try {
    const { specialisation } = req.query;
    const doctors = await doctorService.searchDoctors(specialisation);
    res.json(doctors);
  } catch (err) {
    next(err);
  }
}

async function getDoctorProfile(req, res, next) {
  try {
    const doctor = await doctorService.getDoctorProfile(req.params.doctorId);
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

async function getAvailableSlots(req, res, next) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
    }
    const result = await doctorService.getAvailableSlots(req.params.doctorId, date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { searchDoctors, getDoctorProfile, getAvailableSlots };
