import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // Contoh: "BCA", "Uang Cash", "Mandiri"
  type: { 
    type: String, 
    enum: ['BANK', 'CASH', 'INVESTMENT'], 
    required: true 
  },
  balance: { type: Number, default: 0 }, // Saldo saat ini
  monthlyInterest: { type: Number, default: 0 } // Bunga wajib per bulan (khusus tipe BANK)
}, { timestamps: true });

// Mencegah caching schema lama oleh Mongoose di environment development Next.js
if (process.env.NODE_ENV === 'development' && mongoose.models.Account) {
  delete mongoose.models.Account;
}

export default mongoose.models.Account || mongoose.model('Account', AccountSchema);