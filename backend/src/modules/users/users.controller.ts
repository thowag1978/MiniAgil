import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db';
import bcrypt from 'bcrypt';

export class UsersController {
  async list(req: any, res: Response) {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  }

  async create(req: any, res: Response) {
    const { name, email, password, role } = req.body;
    
    // Auth Check
    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (requester?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado: Somente administradores.' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'USER';

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.status(201).json(newUser);
  }

  async updateRole(req: any, res: Response) {
    const { id } = req.params;
    const { role } = req.body;

    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (requester?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado: Apenas Administradores podem alterar permissões.' });
    }

    if (role !== 'ADMIN' && role !== 'USER') {
      return res.status(400).json({ error: 'Papel (role) inválido' });
    }

    if (id === req.user.id && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Você não pode revogar o próprio acesso de administrador.' });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, name: true, email: true, role: true }
      });
      res.json(updatedUser);
    } catch (e) {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  }

  async updatePassword(req: any, res: Response) {
    const { id } = req.params;
    const { newPassword } = req.body;

    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (requester?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Senha incorreta ou muito curta.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    try {
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
        select: { id: true, name: true, email: true }
      });
      res.json({ success: true });
    } catch (e) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
    }
  }

  async delete(req: any, res: Response) {
    const { id } = req.params;

    const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (requester?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Você não pode deletar sua própria conta.' });
    }

    try {
      await prisma.user.delete({ where: { id } });
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'P2003') { // Prisma Foreign Key constraint error
        res.status(400).json({ error: 'Impossível apagar: Usuário possui itens ou projetos atrelados a ele. Remova suas permissões (Altere para USER ou desvincule) em vez de apagá-lo.' });
      } else {
        res.status(500).json({ error: 'Erro interno ao deletar.' });
      }
    }
  }
}
