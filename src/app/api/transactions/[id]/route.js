import dbConnect from "../../../../lib/mongodb";
import Transaction from "../../../../lib/models/Transaction";
import Account from "../../../../lib/models/Account";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await dbConnect();

    // 1. Cari transaksi yang ingin dihapus
    const transaction = await Transaction.findOne({ _id: id, userId: session.user.id });
    if (!transaction) {
      return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // 2. Cari akun terkait
    const account = await Account.findById(transaction.accountId);
    if (account) {
      // 3. Batalkan dampak nominal transaksi terhadap saldo akun
      const transactionAmount = Number(transaction.amount);
      if (transaction.type === "INCOME") {
        account.balance -= transactionAmount;
      } else if (transaction.type === "EXPENSE") {
        account.balance += transactionAmount;
      }
      await account.save();
    }

    // 4. Hapus transaksi dari database
    await Transaction.deleteOne({ _id: id });

    return NextResponse.json({ message: "Transaksi berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
