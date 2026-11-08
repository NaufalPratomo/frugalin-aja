import mongoose from 'mongoose';

// Cache saldo akhir bulan per rekening. Bukan sumber kebenaran: dibuang
// (invalidateSnapshots) setiap kali ada perubahan yang menyentuh masa lalu.
const AccountSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, // "YYYY-MM"
  balances: { type: Map, of: Number, default: {} } // accountId -> saldo akhir bulan
}, { timestamps: true });

AccountSnapshotSchema.index({ userId: 1, month: 1 }, { unique: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.AccountSnapshot) {
  delete mongoose.models.AccountSnapshot;
}

export default mongoose.models.AccountSnapshot || mongoose.model('AccountSnapshot', AccountSnapshotSchema);
