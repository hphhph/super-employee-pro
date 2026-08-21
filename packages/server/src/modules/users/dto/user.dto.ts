import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsIn, Length, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @Length(2, 50, { message: '用户名长度需在 2-50 之间' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名仅支持字母、数字、下划线' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @Length(6, 50, { message: '密码长度需在 6-50 之间' })
  password: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsIn(['admin', 'manager', 'user'], { message: '角色只能是 admin / manager / user' })
  role?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(0, 50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsIn(['admin', 'manager', 'user'], { message: '角色只能是 admin / manager / user' })
  role?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsIn([0, 1], { message: '状态只能是 0（禁用）或 1（启用）' })
  status?: number;

  @IsOptional()
  @IsString()
  @Length(6, 50, { message: '密码长度需在 6-50 之间' })
  password?: string;
}

export class RechargeDto {
  @IsInt()
  @Min(1)
  @Max(1000000)
  amount: number;
}
