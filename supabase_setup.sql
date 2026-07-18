
-- 1. إنشاء جدول المرضى (patients) مع عمود user_id ومفاتيح أجنبية لربطه بجدول مستخدمي النظام
create table if not exists patients (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  status text
);

-- 2. تفعيل سياسة الأمان الخاصة بمستوى السطر (Row Level Security - RLS)
alter table patients enable row level security;

-- 3. وضع قواعد أمان صارمة تعزل بيانات كل طبيب عن الآخر بشكل كامل وآمن:

-- سياسة جلب وقراءة السجلات: يسمح للمستخدم فقط برؤية السجلات التابعة له
create policy "Users can view their own patients" on patients
  for select
  using (auth.uid() = user_id);

-- سياسة تفويض وإنشاء سجل جديد: يسمح للمستخدم بتسجيل المرضى الخاصين به فقط
create policy "Users can insert their own patients" on patients
  for insert
  with check (auth.uid() = user_id);

-- سياسة تعديل السجلات: يسمح للمستخدم بتحديث سجلات مرضاه فقط
create policy "Users can update their own patients" on patients
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- سياسة حذف السجلات: يسمح للمستخدم بمسح ملفات مرضاه الذين ينتمون له فقط
create policy "Users can delete their own patients" on patients
  for delete
  using (auth.uid() = user_id);

