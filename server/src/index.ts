import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import healthRouter from './routes/health';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8080;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Middleware
app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'FlowSense API Server',
    description: 'Backend API for Dhan trading platform',
    version: '1.0.0',
    endpoints: {
      health: '/api/health'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.url} not found`
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║        FlowSense Server Running       ║
  ╠═══════════════════════════════════════╣
  ║  Port: ${PORT.toString().padEnd(30)}  ║
  ║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}  ║
  ║  Client URL: ${CLIENT_URL.padEnd(24)}  ║
  ╚═══════════════════════════════════════╝
  `);
});

export default app;
