import dbConnect from "../../../lib/mongodb";
import Account from "../../../lib/models/Account";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const accounts = await Account.find({ userId: session.user.id });
    return NextResponse.json(accounts, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name, type, balance } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ message: "Nama dan Tipe wajib diisi" }, { status: 400 });
    }

    await dbConnect();
    const newAccount = await Account.create({
      userId: session.user.id,
      name,
      type,
      balance: balance || 0
    });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}