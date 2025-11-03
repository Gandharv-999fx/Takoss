
import { Router } from 'express';
import { postNameentryCreate } from './handlers/postNameentryCreate';
import { getNameentryRead } from './handlers/getNameentryRead';
import { getNameentryList } from './handlers/getNameentryList';
import { putNameentryUpdate } from './handlers/putNameentryUpdate';
import { deleteNameentryDelete } from './handlers/deleteNameentryDelete';

const router = Router();

// API Routes
router.post('/nameentrys', postNameentryCreate);
router.get('/nameentrys/:id', getNameentryRead);
router.get('/nameentrys', getNameentryList);
router.put('/nameentrys/:id', putNameentryUpdate);
router.delete('/nameentrys/:id', deleteNameentryDelete);

export default router;
