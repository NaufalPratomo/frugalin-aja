import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // Contoh: "BCA", "Uang Cash", "Mandiri"
  type: { 
    type: String, 
    enum: ['BANK', 'CASH', 'INVESTMENT'], 
    required: true 
  },
  balance: { type: Number, default: 0 } // Saldo saat ini
}, { timestamps: true });

export default mongoose.models.Account || mongoose.model('Account', AccountSchema);