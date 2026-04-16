import type { Request, Response } from 'express';
import axios from 'axios';

export const getWastePrediction = async (req: Request, res: Response) => {
    try {
        // Panggil server Python yang sedang jalan (FastAPI)
        const response = await axios.get('http://127.0.0.1:8000/api/predict-waste');
        
        // Kirim hasil prediksi ke Frontend Next.js
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Gagal mengambil prediksi dari Python:", error);
        return res.status(500).json({ message: "AI Engine sedang tidak aktif" });
    }
};