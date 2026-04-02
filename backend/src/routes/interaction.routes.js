const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interaction.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/:leadId', interactionController.getByLeadId);
router.post('/:leadId', interactionController.create);

module.exports = router;
