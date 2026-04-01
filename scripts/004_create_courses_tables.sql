-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('qualifier', 'foundation')),
  type TEXT NOT NULL CHECK (type IN ('free', 'paid')),
  weeks INTEGER NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  thumbnail TEXT,
  instructor TEXT NOT NULL,
  students_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  UNIQUE(user_id, course_id)
);

-- Create user_profiles table (extended)
CREATE TABLE IF NOT EXISTS user_profiles_extended (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT,
  github TEXT,
  linkedin TEXT,
  portfolio TEXT,
  about TEXT,
  education TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);

-- Enable Row Level Security
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles_extended ENABLE ROW LEVEL SECURITY;

-- Policies for courses (everyone can read)
CREATE POLICY "Anyone can view courses" ON courses
  FOR SELECT USING (true);

-- Policies for enrollments (users can only see their own)
CREATE POLICY "Users can view their own enrollments" ON enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own enrollments" ON enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own enrollments" ON enrollments
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for user_profiles_extended
CREATE POLICY "Users can view their own profile" ON user_profiles_extended
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles_extended
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles_extended
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Insert sample courses
INSERT INTO courses (id, title, description, level, type, weeks, price, thumbnail, instructor, students_count) VALUES
  ('qualifier-math-1', 'Mathematics 1', 'Master the fundamentals of mathematics including calculus, algebra, and trigonometry.', 'qualifier', 'free', 4, 0, '/courses/math.jpg', 'IITM BS Faculty', 2450),
  ('qualifier-stats-1', 'Statistics 1', 'Learn statistical concepts, probability theory, and data analysis techniques.', 'qualifier', 'free', 4, 0, '/courses/stats.jpg', 'IITM BS Faculty', 1890),
  ('qualifier-computational-thinking', 'Computational Thinking', 'Develop problem-solving skills and learn the basics of programming logic.', 'qualifier', 'free', 4, 0, '/courses/ct.jpg', 'IITM BS Faculty', 3120),
  ('qualifier-english-1', 'English 1', 'Enhance your English language skills including grammar, comprehension, and writing.', 'qualifier', 'free', 4, 0, '/courses/english.jpg', 'IITM BS Faculty', 2780),
  ('foundation-math-2', 'Mathematics 2', 'Advanced mathematics covering linear algebra, differential equations, and complex analysis.', 'foundation', 'paid', 12, 2500, '/courses/math.jpg', 'IITM BS Faculty', 1560),
  ('foundation-stats-2', 'Statistics 2', 'Advanced statistical methods, hypothesis testing, and regression analysis.', 'foundation', 'paid', 12, 2500, '/courses/stats.jpg', 'IITM BS Faculty', 1230),
  ('foundation-programming-python', 'Programming in Python', 'Learn Python from basics to advanced concepts including data structures and algorithms.', 'foundation', 'paid', 12, 3000, '/courses/ct.jpg', 'IITM BS Faculty', 2890),
  ('foundation-english-2', 'English 2', 'Advanced English communication, business writing, and presentation skills.', 'foundation', 'paid', 12, 2000, '/courses/english.jpg', 'IITM BS Faculty', 1450)
ON CONFLICT (id) DO NOTHING;
