-- Create profiles table for storing user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'student',
  profile_picture_url TEXT,
  bio TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT,
  level TEXT DEFAULT 'beginner',
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Create enrollments table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, course_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Create study_materials table
CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT,
  file_url TEXT,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  total_questions INTEGER,
  passing_score INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score INTEGER,
  passed BOOLEAN,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  courses_completed INTEGER DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Create mentor_requests table
CREATE TABLE IF NOT EXISTS public.mentor_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  subject TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.mentor_requests ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR profiles
CREATE POLICY "Public read access to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS POLICIES FOR courses
CREATE POLICY "Public read access to courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Mentors can create courses" ON public.courses FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor')
);
CREATE POLICY "Course instructors can update their courses" ON public.courses FOR UPDATE USING (
  instructor_id = auth.uid()
);

-- RLS POLICIES FOR enrollments
CREATE POLICY "Users can view their own enrollments" ON public.enrollments FOR SELECT USING (
  student_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Students can enroll in courses" ON public.enrollments FOR INSERT WITH CHECK (
  student_id = auth.uid()
);
CREATE POLICY "Students can update their own enrollments" ON public.enrollments FOR UPDATE USING (
  student_id = auth.uid()
);

-- RLS POLICIES FOR study_materials
CREATE POLICY "Public read access to study materials" ON public.study_materials FOR SELECT USING (true);
CREATE POLICY "Instructors can manage study materials" ON public.study_materials FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid())
);

-- RLS POLICIES FOR quizzes
CREATE POLICY "Public read access to quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Instructors can manage quizzes" ON public.quizzes FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid())
);

-- RLS POLICIES FOR quiz_attempts
CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts FOR SELECT USING (
  student_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Students can create quiz attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (
  student_id = auth.uid()
);

-- RLS POLICIES FOR leaderboard
CREATE POLICY "Public read access to leaderboard" ON public.leaderboard FOR SELECT USING (true);
CREATE POLICY "System can update leaderboard" ON public.leaderboard FOR UPDATE USING (true);

-- RLS POLICIES FOR mentor_requests
CREATE POLICY "Users can view their own mentor requests" ON public.mentor_requests FOR SELECT USING (
  student_id = auth.uid() OR mentor_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Students can create mentor requests" ON public.mentor_requests FOR INSERT WITH CHECK (
  student_id = auth.uid()
);
CREATE POLICY "Mentors can update mentor requests" ON public.mentor_requests FOR UPDATE USING (
  mentor_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

