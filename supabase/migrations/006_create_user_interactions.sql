-- Migration: Create user interaction tables
-- Description: Reviews, messages, and saved items for user interactions

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,

  -- Rating fields (1-5 scale)
  overall_rating INTEGER NOT NULL,
  quality_rating INTEGER,
  reliability_rating INTEGER,
  communication_rating INTEGER,

  -- Review content
  title TEXT,
  comment TEXT,

  -- Metadata
  work_completed BOOLEAN, -- Was work actually carried out
  would_recommend BOOLEAN,
  response_text TEXT, -- Professional's response to review
  response_date TIMESTAMPTZ,

  -- Status and timestamps
  is_verified BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT reviews_overall_rating_range CHECK (overall_rating >= 1 AND overall_rating <= 5),
  CONSTRAINT reviews_quality_rating_range CHECK (quality_rating IS NULL OR (quality_rating >= 1 AND quality_rating <= 5)),
  CONSTRAINT reviews_reliability_rating_range CHECK (reliability_rating IS NULL OR (reliability_rating >= 1 AND reliability_rating <= 5)),
  CONSTRAINT reviews_communication_rating_range CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)),
  CONSTRAINT reviews_title_length CHECK (title IS NULL OR length(title) <= 200),
  CONSTRAINT reviews_comment_length CHECK (comment IS NULL OR length(comment) <= 2000),
  CONSTRAINT reviews_response_length CHECK (response_text IS NULL OR length(response_text) <= 1000),

  -- Prevent self-reviews (reviewer cannot review their own professional profile)
  CONSTRAINT reviews_no_self_review CHECK (
    reviewer_id != (SELECT user_id FROM public.professionals WHERE id = professional_id)
  )
);

-- Create messages table for project-based communication
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.project_applications(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Message content
  subject TEXT,
  content TEXT NOT NULL,

  -- Message type and metadata
  message_type TEXT DEFAULT 'text', -- 'text', 'application', 'quote', 'update'
  attachments TEXT[], -- Array of file URLs/paths

  -- Status tracking
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT messages_content_not_empty CHECK (length(trim(content)) > 0),
  CONSTRAINT messages_content_length CHECK (length(content) <= 5000),
  CONSTRAINT messages_subject_length CHECK (subject IS NULL OR length(subject) <= 200),
  CONSTRAINT messages_type_valid CHECK (message_type IN ('text', 'application', 'quote', 'update', 'system')),

  -- Prevent self-messaging
  CONSTRAINT messages_no_self_message CHECK (sender_id != recipient_id),

  -- Read timestamp logic
  CONSTRAINT messages_read_logic CHECK (
    (is_read = FALSE AND read_at IS NULL) OR
    (is_read = TRUE AND read_at IS NOT NULL)
  )
);

-- Create saved_projects table
CREATE TABLE public.saved_projects (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  notes TEXT, -- Private notes about why they saved it
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, project_id),

  -- Constraints
  CONSTRAINT saved_projects_notes_length CHECK (notes IS NULL OR length(notes) <= 500)
);

-- Create saved_professionals table
CREATE TABLE public.saved_professionals (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  notes TEXT, -- Private notes about why they saved them
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, professional_id),

  -- Constraints
  CONSTRAINT saved_professionals_notes_length CHECK (notes IS NULL OR length(notes) <= 500),

  -- Prevent saving own professional profile
  CONSTRAINT saved_professionals_no_self_save CHECK (
    user_id != (SELECT user_id FROM public.professionals WHERE id = professional_id)
  )
);

-- Create notifications table for system notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'info',

  -- Related entities
  related_project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  related_professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  related_review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  related_message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,

  -- Action URL for clickable notifications
  action_url TEXT,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT notifications_title_length CHECK (length(title) <= 200),
  CONSTRAINT notifications_message_length CHECK (length(message) <= 1000),
  CONSTRAINT notifications_type_valid CHECK (
    notification_type IN ('info', 'success', 'warning', 'error', 'message', 'review', 'application')
  ),
  CONSTRAINT notifications_read_logic CHECK (
    (is_read = FALSE AND read_at IS NULL) OR
    (is_read = TRUE AND read_at IS NOT NULL)
  )
);

-- Enable RLS on all tables
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers
CREATE TRIGGER handle_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to update professional ratings when review is added/updated
CREATE OR REPLACE FUNCTION public.update_professional_ratings()
RETURNS TRIGGER AS $$
DECLARE
  prof_id UUID;
  avg_overall DECIMAL(3,2);
  avg_quality DECIMAL(3,2);
  avg_reliability DECIMAL(3,2);
  avg_communication DECIMAL(3,2);
  review_count INTEGER;
  last_review TIMESTAMPTZ;
BEGIN
  -- Get the professional_id from either NEW or OLD record
  prof_id := COALESCE(NEW.professional_id, OLD.professional_id);

  -- Calculate new averages and count
  SELECT
    ROUND(AVG(overall_rating), 2),
    ROUND(AVG(quality_rating), 2),
    ROUND(AVG(reliability_rating), 2),
    ROUND(AVG(communication_rating), 2),
    COUNT(*),
    MAX(created_at)
  INTO avg_overall, avg_quality, avg_reliability, avg_communication, review_count, last_review
  FROM public.reviews
  WHERE professional_id = prof_id AND is_published = TRUE;

  -- Update the professional_ratings table
  INSERT INTO public.professional_ratings (
    professional_id, overall_rating, quality_rating, reliability_rating,
    communication_rating, total_reviews, last_review_at, updated_at
  )
  VALUES (
    prof_id, COALESCE(avg_overall, 0), COALESCE(avg_quality, 0),
    COALESCE(avg_reliability, 0), COALESCE(avg_communication, 0),
    COALESCE(review_count, 0), last_review, NOW()
  )
  ON CONFLICT (professional_id) DO UPDATE SET
    overall_rating = EXCLUDED.overall_rating,
    quality_rating = EXCLUDED.quality_rating,
    reliability_rating = EXCLUDED.reliability_rating,
    communication_rating = EXCLUDED.communication_rating,
    total_reviews = EXCLUDED.total_reviews,
    last_review_at = EXCLUDED.last_review_at,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for rating updates
CREATE TRIGGER update_professional_ratings_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_professional_ratings();

-- Function to mark message as read when read_at is set
CREATE OR REPLACE FUNCTION public.handle_message_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    NEW.is_read := TRUE;
  ELSIF NEW.read_at IS NULL THEN
    NEW.is_read := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_message_read_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_read();

-- Similar function for notifications
CREATE TRIGGER handle_notification_read_trigger
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_read();

-- Add indexes
CREATE INDEX idx_reviews_professional_id ON public.reviews(professional_id);
CREATE INDEX idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX idx_reviews_project_id ON public.reviews(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_reviews_published ON public.reviews(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_reviews_created_at ON public.reviews(created_at DESC);
CREATE INDEX idx_reviews_overall_rating ON public.reviews(overall_rating);

CREATE INDEX idx_messages_project_id ON public.messages(project_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX idx_messages_conversation ON public.messages(project_id, sent_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(recipient_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_messages_sent_at ON public.messages(sent_at DESC);

CREATE INDEX idx_saved_projects_user_id ON public.saved_projects(user_id);
CREATE INDEX idx_saved_projects_created_at ON public.saved_projects(user_id, created_at DESC);

CREATE INDEX idx_saved_professionals_user_id ON public.saved_professionals(user_id);
CREATE INDEX idx_saved_professionals_created_at ON public.saved_professionals(user_id, created_at DESC);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(notification_type);

-- Add comments
COMMENT ON TABLE public.reviews IS 'User reviews and ratings for professionals';
COMMENT ON TABLE public.messages IS 'Project-based messaging between users';
COMMENT ON TABLE public.saved_projects IS 'Projects saved by users for later reference';
COMMENT ON TABLE public.saved_professionals IS 'Professionals saved by users for later reference';
COMMENT ON TABLE public.notifications IS 'System notifications for users';

COMMENT ON COLUMN public.reviews.work_completed IS 'Whether work was actually carried out';
COMMENT ON COLUMN public.reviews.would_recommend IS 'Whether reviewer would recommend this professional';
COMMENT ON COLUMN public.reviews.response_text IS 'Professionals response to the review';

COMMENT ON COLUMN public.messages.application_id IS 'Related application if message is about an application';
COMMENT ON COLUMN public.messages.message_type IS 'Type of message for UI handling';
COMMENT ON COLUMN public.messages.attachments IS 'Array of attachment URLs/paths';

COMMENT ON COLUMN public.notifications.action_url IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN public.notifications.notification_type IS 'Type for styling and handling';