import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    const { password, ...rest } = createUserDto;
    const user = this.usersRepo.create({
      ...rest,
      passwordHash: password,
    });
    return this.usersRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateRefreshToken(
    userId: string,
    tokenHash: string | null,
  ): Promise<void> {
    await this.usersRepo.update(userId, {
      refreshTokenHash: tokenHash ?? undefined,
    });
  }

  async findAll(role?: UserRole): Promise<User[]> {
    const where = role ? { role } : {};
    return this.usersRepo.find({
      where,
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'company',
        'isActive',
        'createdAt',
      ] as (keyof User)[],
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepo.update(id, { isActive: false });
  }

  /** Store a hashed reset token valid for 1 hour */
  async setResetToken(userId: string, token: string): Promise<void> {
    const hash = await bcrypt.hash(token, 10);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.usersRepo.update(userId, {
      resetToken: hash,
      resetTokenExpiry: expiry,
    });
  }

  /** Validate plain token against stored hash and expiry, return user if valid */
  async validateResetToken(email: string, token: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user?.resetToken || !user.resetTokenExpiry) return null;
    if (user.resetTokenExpiry < new Date()) return null;
    const match = await bcrypt.compare(token, user.resetToken);
    return match ? user : null;
  }

  /** Set new password and clear reset token */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.update(userId, {
      passwordHash: hash,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });
  }
}
