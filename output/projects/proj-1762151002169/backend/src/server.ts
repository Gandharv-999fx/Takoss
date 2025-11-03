import express from 'express';
import cors from 'cors';
import route0 from './routes/handlers/postNameentryCreate';
import route1 from './routes/handlers/getNameentryRead';
import route2 from './routes/handlers/getNameentryList';
import route3 from './routes/handlers/putNameentryUpdate';
import route4 from './routes/handlers/deleteNameentryDelete';
import route5 from './routes/router';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', route0);
app.use('/api', route1);
app.use('/api', route2);
app.use('/api', route3);
app.use('/api', route4);
app.use('/api', route5);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
