import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
