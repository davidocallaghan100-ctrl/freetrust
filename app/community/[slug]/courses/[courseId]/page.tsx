'use client'
import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  body: string
  video_url: string | null
  position: number
}

interface Course {
  id: string
  title: string
  description: string
}

export default function CoursePage({ params }: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug, courseId } = use(params)
  const [currentLesson, setCurrentLesson] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/communities/${slug}/courses/${courseId}`)
        if (res.ok) {
          const data = await res.json() as { course?: Course; lessons?: Lesson[] }
          if (data.course) setCourse(data.course)
          if (data.lessons) setLessons(data.lessons)
        }
      } catch { /* leave empty */ }
      finally { setLoading(false) }
    }
    load()
  }, [slug, courseId])

  const lesson = lessons[currentLesson]
  const progress = completed.size
  const total = lessons.length

  const markComplete = () => {
    setCompleted(prev => new Set(Array.from(prev).concat(currentLesson)))
    if (currentLesson < lessons.length - 1) {
      setCurrentLesson(p => p + 1)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!course || lessons.length === 0) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>No course content yet</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Lessons will appear here when the course creator adds them.</p>
          <Link href={`/community/${slug}`} style={{ color: '#38bdf8', fontSize: '0.9rem', textDecoration: 'none' }}>← Back to Group</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .lesson-body h2 { font-size: 1.15rem; font-weight: 700; color: #f1f5f9; margin: 1.25rem 0 0.6rem; }
        .lesson-body h3 { font-size: 1rem; font-weight: 700; color: #cbd5e1; margin: 1rem 0 0.5rem; }
        .lesson-body p { font-size: 0.92rem; color: #cbd5e1; line-height: 1.75; margin: 0 0 0.85rem; }
        .lesson-body ul { font-size: 0.92rem; color: #cbd5e1; line-height: 1.75; margin: 0 0 0.85rem; padding-left: 1.5rem; }
        .lesson-body li { margin-bottom: 0.3rem; }
        .lesson-body strong { color: #f1f5f9; }
        .lesson-sidebar-item:hover { background: rgba(56,189,248,0.06) !important; }
        @media (max-width: 900px) {
          .course-layout { grid-template-columns: 1fr !important; }
          .course-sidebar { border-right: none !important; border-bottom: 1px solid rgba(56,189,248,0.1) !important; max-height: 300px; overflow-y: auto; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.08) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,0.1)', padding: '1.25rem 1.5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.6rem' }}>
            <Link href="/community" style={{ color: '#64748b', textDecoration: 'none' }}>Communities</Link>
            <span>›</span>
            <Link href={`/community/${slug}`} style={{ color: '#64748b', textDecoration: 'none' }}>Community</Link>
            <span>›</span>
            <Link href={`/community/${slug}`} onClick={() => {}} style={{ color: '#64748b', textDecoration: 'none' }}>Classroom</Link>
            <span>›</span>
            <span style={{ color: '#94a3b8' }}>{course.title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.3rem' }}>{course.title}</h1>
              <p style={{ fontSize: '0.83rem', color: '#64748b', margin: 0 }}>{course.description}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{progress}/{total} complete</div>
              <div style={{ width: 120, height: 6, background: 'rgba(148,163,184,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${total > 0 ? (progress / total) * 100 : 0}%`, background: '#38bdf8', borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="course-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 160px)' }}>

        {/* Sidebar */}
        <div className="course-sidebar" style={{ borderRight: '1px solid rgba(56,189,248,0.1)', padding: '1.25rem 0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 1.25rem', marginBottom: '0.75rem' }}>
            Lessons · {total}
          </div>
          {lessons.map((l, i) => (
            <button
              key={l.id}
              className="lesson-sidebar-item"
              onClick={() => setCurrentLesson(i)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.25rem', background: i === currentLesson ? 'rgba(56,189,248,0.08)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: i === currentLesson ? '2px solid #38bdf8' : '2px solid transparent', transition: 'background 0.12s' }}
            >
              <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: completed.has(i) ? '#38bdf8' : i === currentLesson ? 'rgba(56,189,248,0.2)' : 'rgba(148,163,184,0.1)', border: completed.has(i) ? 'none' : i === currentLesson ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: completed.has(i) ? '#0f172a' : i === currentLesson ? '#38bdf8' : '#64748b' }}>
                {completed.has(i) ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.83rem', color: i === currentLesson ? '#f1f5f9' : completed.has(i) ? '#94a3b8' : '#64748b', fontWeight: i === currentLesson ? 600 : 400, lineHeight: 1.3 }}>
                {l.title}
              </span>
            </button>
          ))}
        </div>

        {/* Lesson Content */}
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          {lesson && (
            <div style={{ maxWidth: 720 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Lesson {currentLesson + 1} of {total}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '1.5rem', lineHeight: 1.3 }}>{lesson.title}</h2>

              {lesson.video_url && (
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginBottom: '1.75rem', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
                  <iframe
                    src={lesson.video_url}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    allowFullScreen
                    title={lesson.title}
                  />
                </div>
              )}

              <div className="lesson-body" dangerouslySetInnerHTML={{ __html: lesson.body }} />

              {/* Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(56,189,248,0.1)', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setCurrentLesson(p => Math.max(0, p - 1))}
                  disabled={currentLesson === 0}
                  style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, color: currentLesson === 0 ? '#475569' : '#94a3b8', cursor: currentLesson === 0 ? 'not-allowed' : 'pointer' }}
                >
                  ← Previous
                </button>
                <button
                  onClick={markComplete}
                  style={{ background: completed.has(currentLesson) ? 'rgba(52,211,153,0.1)' : '#38bdf8', border: completed.has(currentLesson) ? '1px solid rgba(52,211,153,0.3)' : 'none', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: completed.has(currentLesson) ? '#34d399' : '#0f172a', cursor: 'pointer' }}
                >
                  {completed.has(currentLesson) ? '✓ Completed' : currentLesson === total - 1 ? '🎉 Complete Course' : 'Mark Complete & Next →'}
                </button>
                {currentLesson < total - 1 && (
                  <button
                    onClick={() => setCurrentLesson(p => Math.min(total - 1, p + 1))}
                    style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
