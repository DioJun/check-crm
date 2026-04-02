const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/stats', leadController.getStats);
router.get('/', leadController.getAll);
router.get('/:id', leadController.getById);
router.post('/', leadController.create);
router.post('/import', leadController.importLeads);
router.put('/:id', leadController.update);
router.delete('/:id', leadController.delete);

module.exports = router;
