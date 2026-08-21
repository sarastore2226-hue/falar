import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - جلب بيانات مستخدم محدد
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await prisma.users.findUnique({
      where: { userid: parseInt(id, 10) },
      select: {
        userid: true,
        usercode: true,
        username: true,
        phone: true,
        position: true,
        permissions: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'فشل في جلب بيانات المستخدم' },
      { status: 500 }
    );
  }
}

// PUT - تحديث بيانات مستخدم
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { username, phone, position, permissions } = await request.json();

    const updatedUser = await prisma.users.update({
      where: { userid: parseInt(id, 10) },
      data: {
        ...(username && { username }),
        ...(phone !== undefined && { phone }),
        ...(position && { position }),
        ...(permissions && { permissions }),
        updated_at: new Date()
      },
      select: {
        userid: true,
        usercode: true,
        username: true,
        phone: true,
        position: true,
        permissions: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات المستخدم بنجاح',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'فشل في تحديث بيانات المستخدم' },
      { status: 500 }
    );
  }
}

// DELETE - حذف مستخدم
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.users.delete({
      where: { userid: parseInt(id, 10) }
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'فشل في حذف المستخدم' },
      { status: 500 }
    );
  }
}