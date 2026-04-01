-- Seed some demo data for testing (Note: passwords should be hashed in production)
-- This script adds sample courses and data to get started

-- Sample Courses
INSERT INTO public.courses (title, description, level, category) VALUES
('Introduction to Web Development', 'Learn the basics of HTML, CSS, and JavaScript', 'beginner', 'Web Development'),
('Advanced React Patterns', 'Master advanced React concepts and patterns', 'advanced', 'Web Development'),
('Python for Data Science', 'Learn data analysis and visualization with Python', 'intermediate', 'Data Science'),
('Machine Learning Fundamentals', 'Introduction to ML algorithms and applications', 'beginner', 'AI & ML'),
('System Design Masterclass', 'Design scalable systems at scale', 'advanced', 'System Design')
ON CONFLICT DO NOTHING;

-- Sample Quiz
INSERT INTO public.quizzes (course_id, title, description, total_questions, passing_score)
SELECT id, 'Quiz 1: Basic Concepts', 'Test your understanding of basic concepts', 10, 70
FROM public.courses
WHERE title = 'Introduction to Web Development'
LIMIT 1
ON CONFLICT DO NOTHING;

