import { Router } from 'express';
import axios from 'axios';

const router = Router();
const PYTHON_API = process.env.PYTHON_API || 'http://127.0.0.1:8000';

// Endpoint untuk ambil prediksi dari Python
router.get('/predict-waste', async (req, res) => {
  try {
    console.log('[AI Route] Fetching prediction from Python...');
    const response = await axios.get(`${PYTHON_API}/api/predict-waste`, {
      timeout: 10000 // 10 detik timeout
    });
    
    return res.status(200).json({
      success: true,
      data: response.data,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[AI Route Error]', error.message);
    return res.status(503).json({ 
      success: false,
      error: 'Python AI Engine sedang offline atau timeout',
      message: error.message
    });
  }
});

export default router;