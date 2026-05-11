'use client';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/components/layout/AuthProvider';
import { ActiveTrackPill } from './ActiveTrackPill';
import { ContinueLessonButton } from './ContinueLessonButton';
import { ReviewQueueBadge } from './ReviewQueueBadge';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarUserPill } from './SidebarUserPill';

export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
  return (
    <aside className="side">
      <div style={{ padding: '0 4px 12px' }}><Logo size="sm" /></div>
      <ActiveTrackPill />
      <SidebarNavItem icon="home" label="Dashboard" href="/dashboard" active={pathname === '/dashboard'} />
      <SidebarNavItem icon="tree" label="Skill tree" href="/tracks" active={pathname.startsWith('/tracks')} />
      <ContinueLessonButton active={pathname.startsWith('/lesson/')} />
      <SidebarNavItem icon="user" label="Profile" href="/profile" active={pathname === '/profile'} />
      <SidebarNavItem icon="trophy" label="Leaderboard" href="/leaderboard" active={pathname === '/leaderboard'} />

      <div className="side-section">More</div>
      <SidebarNavItem
        icon="refresh"
        label="Review"
        href="/review"
        active={pathname === '/review'}
        badge={<ReviewQueueBadge />}
      />
      {isInstructor && (
        <>
          <SidebarNavItem
            icon="trophy"
            label="Instructor"
            href="/instructor"
            active={pathname === '/instructor' || pathname.startsWith('/instructor/review')}
          />
          <SidebarNavItem
            icon="user"
            label="Students"
            href="/instructor/students"
            active={pathname.startsWith('/instructor/students')}
          />
          <SidebarNavItem
            icon="bookmark"
            label="Help inbox"
            href="/instructor/help"
            active={pathname.startsWith('/instructor/help')}
          />
          <SidebarNavItem
            icon="star"
            label="Ratings"
            href="/instructor/ratings"
            active={pathname.startsWith('/instructor/ratings')}
          />
          <SidebarNavItem
            icon="pencil"
            label="Builder"
            href="/instructor/builder"
            active={pathname.startsWith('/instructor/builder')}
          />
          <SidebarNavItem
            icon="tree"
            label="Skill tree"
            href="/instructor/skill-tree"
            active={pathname.startsWith('/instructor/skill-tree')}
          />
          <SidebarNavItem
            icon="trophy"
            label="Badges"
            href="/instructor/badges"
            active={pathname.startsWith('/instructor/badges')}
          />
        </>
      )}
      <SidebarNavItem
        icon="grid"
        label="Design system ↗"
        href="/design-system"
        active={pathname === '/design-system'}
      />

      <SidebarUserPill />
    </aside>
  );
}
