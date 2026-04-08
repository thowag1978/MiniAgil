import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersafesecret123';

export class AuthController {
  async register(req: Request, res: Response) {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword }
    });

    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  async me(req: any, res: Response) {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id }, 
      select: { id: true, email: true, name: true, role: true } 
    });
    res.json(user);
  }
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    // We send success back regardless of user existing to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If the email exists, a reset link will be sent.' });
    }

    const secret = JWT_SECRET + user.password;
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: '15m' });

    const resetLink = `http://localhost:3001/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    
    console.log('\n=============================================');
    console.log('🔒 PASSWORD RECOVERY LINK REQUESTED');
    console.log(`User: ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log('=============================================\n');

    res.json({ message: 'If the email exists, a reset link will be sent.' });
  }

  async resetPassword(req: Request, res: Response) {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const secret = JWT_SECRET + user.password;
    try {
      jwt.verify(token, secret);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password successfully reset' });
  }
}
