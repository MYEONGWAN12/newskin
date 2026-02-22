/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Calendar,
  User,
  ExternalLink,
  Filter,
  Github,
  Code,
  Palette,
  Lightbulb,
  MoreHorizontal,
  LogOut,
  LogIn,
  ArrowRight,
  Compass,
  Users,
  Layers,
  Smartphone,
  Cpu,
  Globe,
  Trophy,
  Award as AwardIcon,
  Home,
  Briefcase,
  Pencil,
  Check,
  Trash2,
  Settings,
  UserCircle,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare,
  Send,
  Sparkles,
  Heart,
  Star,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

// --- Types ---
interface UserProfile {
  id: string;
  email: string;
  name: string;
  major?: string;
  skills?: string[];
  github_url?: string;
}

interface Post {
  id: string;
  author_id: string;
  title: string;
  category: '교내' | '교외' | '서포터즈' | '기타';
  content: string;
  deadline: string;
  contact_link: string;
  status: '모집 중' | '모집 완료';
  created_at: string;
  author?: UserProfile;
  member_count?: number;
}

interface Award {
  id: string;
  title: string;
  description: string;
  award_date: string;
  image_url?: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: UserProfile;
}

// --- Components ---

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case '교내': return <Home size={14} className="mr-1.5" />;
    case '교외': return <Globe size={14} className="mr-1.5" />;
    case '서포터즈': return <Briefcase size={14} className="mr-1.5" />;
    default: return <MoreHorizontal size={14} className="mr-1.5" />;
  }
};

const SkillBadge = ({ skill }: { skill: string;[key: string]: any }) => {
  const lowerSkill = skill.toLowerCase();
  if (lowerSkill.includes('react')) return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100">React</Badge>;
  if (lowerSkill.includes('next')) return <Badge variant="outline" className="bg-slate-900 text-white border-slate-800">Next.js</Badge>;
  if (lowerSkill.includes('typescript') || lowerSkill.includes('ts')) return <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100">TS</Badge>;
  if (lowerSkill.includes('design') || lowerSkill.includes('figma')) return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100">Design</Badge>;
  return <Badge variant="outline" className="bg-slate-50 border-slate-100 text-slate-600">{skill}</Badge>;
};

const CATEGORIES = ['전체', '교내', '교외', '서포터즈', '기타'];

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [myJoins, setMyJoins] = useState<string[]>([]); // Array of post IDs
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // UI States
  const [activeTab, setActiveTab] = useState<'posts' | 'awards'>('posts');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostData, setEditPostData] = useState<Partial<Post>>({});
  const [filter, setFilter] = useState<string>('전체');

  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [newComment, setNewComment] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'success'>('idle');
  const [pendingAction, setPendingAction] = useState<{ type: string; data: any } | null>(null);
  const [newPost, setNewPost] = useState({
    title: '',
    category: '교내' as const,
    content: '',
    deadline: '',
    contact_link: '',
  });

  const [newAward, setNewAward] = useState({
    title: '',
    description: '',
    award_date: '',
  });

  const [profileForm, setProfileForm] = useState({
    name: '',
    major: '',
  });

  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    name: '',
    major: '',
    isSignUp: false,
  });

  useEffect(() => {
    fetchPosts();
    fetchAwards();
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchUserActivity(session.user.id);
      } else {
        setProfile(null);
        setMyJoins([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      fetchProfile(session.user.id);
      fetchUserActivity(session.user.id);
    }
  };

  const fetchUserActivity = async (userId: string) => {
    // Fetch joined posts
    const { data: joinData } = await supabase
      .from('post_members')
      .select('post_id')
      .eq('user_id', userId);

    if (joinData) setMyJoins(joinData.map(j => j.post_id));
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      setProfileForm({
        name: data.name || '',
        major: data.major || '',
      });
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    // Fetch posts with member counts
    const { data, error } = await supabase
      .from('posts')
      .select('*, author:users(*), post_members(count)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      const formattedPosts = data?.map(post => ({
        ...post,
        member_count: post.post_members?.[0]?.count || 0
      })) || [];
      setPosts(formattedPosts);
    }
    setLoading(false);
  };

  const fetchAwards = async () => {
    const { data, error } = await supabase
      .from('awards')
      .select('*')
      .order('award_date', { ascending: false });

    if (error) {
      console.error('Error fetching awards:', error);
    } else {
      setAwards(data || []);
    }
  };

  const handleCreateAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase
      .from('awards')
      .insert([newAward]);

    if (error) {
      alert('수상 내역 등록 실패: ' + error.message);
    } else {
      setIsAwardModalOpen(false);
      setNewAward({ title: '', description: '', award_date: '' });
      fetchAwards();
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('users')
      .update({
        name: profileForm.name,
        major: profileForm.major,
      })
      .eq('id', user.id);

    if (error) {
      alert('프로필 수정 실패: ' + error.message);
    } else {
      setIsProfileModalOpen(false);
      fetchProfile(user.id);
    }
    setActionLoading(false);
  };

  const handleJoinPost = async (postId: string) => {
    if (!user) {
      setPendingAction({ type: 'join', data: postId });
      setIsAuthModalOpen(true);
      return;
    }
    setActionLoading(true);

    const isAlreadyJoined = myJoins.includes(postId);

    if (isAlreadyJoined) {
      // Leave post
      const { error } = await supabase
        .from('post_members')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (!error) {
        setMyJoins(prev => prev.filter(id => id !== postId));
        fetchPosts();
        fetchParticipants(postId);
        if (selectedPost?.id === postId) {
          setSelectedPost(prev => prev ? { ...prev, member_count: Math.max(0, (prev.member_count || 1) - 1) } : null);
        }
      }
    } else {
      // Join post
      const { error } = await supabase
        .from('post_members')
        .insert([{ post_id: postId, user_id: user.id }]);

      if (error) {
        if (error.code === '23505') {
          alert('이미 참가 신청을 하셨습니다.');
        } else {
          alert('참가 신청 실패: ' + error.message);
        }
      } else {
        setMyJoins(prev => [...prev, postId]);
        fetchPosts();
        fetchParticipants(postId);
        if (selectedPost?.id === postId) {
          setSelectedPost(prev => prev ? { ...prev, member_count: (prev.member_count || 0) + 1 } : null);
        }
      }
    }
    setActionLoading(false);
  };

  const fetchParticipants = async (postId: string) => {
    const { data } = await supabase
      .from('post_members')
      .select('user:users(*)')
      .eq('post_id', postId);

    if (data) {
      setParticipants(data.map((item: any) => item.user).filter(Boolean));
    }
  };

  const handleAskAI = () => {
    if (!selectedPost) return;
    const prompt = `이 공모전에 대해 자세히 알려줘:\n제목: ${selectedPost.title}\n내용: ${selectedPost.content}`;
    navigator.clipboard.writeText(prompt);
    alert('프롬프트가 복사되었습니다! Gemini에서 붙여넣어 질문해보세요.');
    window.open('https://gemini.google.com/app', '_blank');
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !newComment.trim()) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('comments')
      .insert([{
        post_id: selectedPost.id,
        user_id: user.id,
        content: newComment.trim()
      }]);

    if (!error) {
      setNewComment('');
    }
    setActionLoading(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      alert('삭제 실패: ' + error.message);
    } else {
      setSelectedPost(null);
      fetchPosts();
    }
    setActionLoading(false);
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !user || user.id !== selectedPost.author_id) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('posts')
      .update({
        title: editPostData.title,
        category: editPostData.category,
        content: editPostData.content,
        deadline: editPostData.deadline,
        contact_link: editPostData.contact_link,
      })
      .eq('id', selectedPost.id);

    if (error) {
      alert('글 수정 실패: ' + error.message);
    } else {
      setIsEditingPost(false);
      const updatedPost = { ...selectedPost, ...editPostData };
      setSelectedPost(updatedPost as Post);
      fetchPosts();
    }
    setActionLoading(false);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!newPost.deadline) {
      alert('마감일을 선택해주세요.');
      return;
    }

    setActionLoading(true);

    const { error } = await supabase
      .from('posts')
      .insert([
        {
          ...newPost,
          author_id: user.id,
          status: '모집 중'
        }
      ]);

    if (error) {
      alert('글 작성에 실패했습니다: ' + error.message);
    } else {
      setIsPostModalOpen(false);
      setNewPost({ title: '', category: '교내', content: '', deadline: '', contact_link: '' });
      fetchPosts();
    }
    setActionLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    let result;
    if (authForm.isSignUp) {
      // 1. Sign Up
      result = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
      });

      if (!result.error && result.data.user) {
        // 2. Create Profile (Use upsert to avoid conflict with trigger)
        const { error: profileError } = await supabase
          .from('users')
          .upsert([
            {
              id: result.data.user.id,
              email: authForm.email,
              name: authForm.name,
              major: authForm.major
            }
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }
    } else {
      result = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      });
    }

    if (result.error) {
      alert('인증 실패: ' + result.error.message);
    } else {
      setAuthStatus('success');
      setTimeout(() => {
        setIsAuthModalOpen(false);
        setAuthStatus('idle');
        setAuthForm({
          email: '',
          password: '',
          name: '',
          major: '',
          isSignUp: false,
        });

        // Execute pending action
        if (pendingAction) {
          if (pendingAction.type === 'join') {
            handleJoinPost(pendingAction.data);
          }
          setPendingAction(null);
        }
      }, 1500);
    }
    setActionLoading(true); // Keep loading during success state
    setTimeout(() => setActionLoading(false), 1500);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const filteredPosts = posts.filter(post => {
    const matchesFilter = filter === '전체' || post.category === filter;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* --- Navbar --- */}
      <nav className="glass-nav">
        <div className="container mx-auto flex h-14 md:h-[72px] items-center justify-between px-5 md:px-8">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-[#3182f6] flex items-center justify-center">
              <span className="text-white text-sm md:text-base font-extrabold">P</span>
            </div>
            <span className="text-lg md:text-xl font-extrabold tracking-[-0.03em] text-[#191f28]">PINSKIN</span>
          </motion.div>

          <div className="flex items-center gap-2 md:gap-4">
            {user ? (
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="hidden items-center gap-3 sm:flex px-4 py-2 rounded-2xl hover:bg-[#f2f4f6] transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#3182f6] to-[#1b64da] flex items-center justify-center text-white text-xs font-bold">
                    {(profile?.name || user.email)[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-[#191f28]">{profile?.name || user.email.split('@')[0]}</span>
                </button>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => setIsProfileModalOpen(true)} className="text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-xl h-9 w-9 p-0 sm:hidden">
                    <User size={18} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-xl h-9 w-9 p-0">
                    <LogOut size={18} />
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" onClick={() => setIsAuthModalOpen(true)} className="bg-[#191f28] hover:bg-[#333d4b] text-white rounded-xl px-5 font-bold h-10 text-sm shadow-none">
                시작하기
              </Button>
            )}
          </div>
        </div>
      </nav>


      {/* --- Hero Section (Desktop Only) --- */}
      <section className="hidden md:block bg-white py-32 overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(49,130,246,0.05)_0%,transparent_50%)] pointer-events-none" />
        <div className="container mx-auto px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl text-left"
          >
            <h1 className="mb-8 text-[80px] font-extrabold tracking-[-0.04em] text-[#191f28] leading-[1.05]">
              <span className="relative inline-block">
                <span className="relative z-10 text-[#3182f6]">최고의 동료</span>
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  className="absolute bottom-2 left-0 h-5 bg-blue-100/60 -z-10 rounded-full"
                />
              </span>를 찾으세요.
            </h1>

            <p className="mb-12 max-w-xl text-xl font-medium leading-relaxed text-[#4e5968]">
              공모전, 서포터즈 팀원을 만나는 가장 쉬운 방법.
            </p>

            <div className="flex gap-4">
              <Button
                size="lg"
                className="h-16 rounded-full bg-[#3182f6] px-12 text-lg font-bold text-white shadow-2xl shadow-blue-100 transition-all hover:bg-[#1b64da] hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => setIsPostModalOpen(true)}
              >
                모집글 올리기
                <ArrowRight size={20} className="ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-16 rounded-full border-slate-200 bg-white px-12 text-lg font-bold text-[#4e5968] transition-all hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => document.getElementById('posts-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                프로젝트 둘러보기
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- Main Content --- */}
      <main id="posts-section" className="container mx-auto px-4 md:px-8 pt-3 pb-6 md:py-20">
        {/* Segmented Control Tabs (Toss Style) */}
        <div className="mb-8 md:mb-12 flex justify-center md:justify-start">
          <div className="inline-flex items-center rounded-2xl bg-[#f2f4f6] p-1.5 md:bg-transparent md:p-0 md:gap-8 md:border-b md:border-slate-100 md:w-full">
            <button
              onClick={() => setActiveTab('posts')}
              className={cn(
                "px-6 py-2.5 rounded-xl md:rounded-none md:px-0 md:pb-4 text-sm md:text-xl font-bold transition-all whitespace-nowrap",
                activeTab === 'posts'
                  ? "bg-white text-[#3182f6] shadow-sm md:bg-transparent md:text-[#3182f6] md:border-b-[3px] md:border-[#3182f6] md:shadow-none"
                  : "text-[#8b95a1] md:text-[#adb5bd] md:border-b-[3px] md:border-transparent hover:text-[#4e5968]"
              )}
            >
              모집 게시판
            </button>
            <button
              onClick={() => setActiveTab('awards')}
              className={cn(
                "px-6 py-2.5 rounded-xl md:rounded-none md:px-0 md:pb-4 text-sm md:text-xl font-bold transition-all whitespace-nowrap",
                activeTab === 'awards'
                  ? "bg-white text-[#3182f6] shadow-sm md:bg-transparent md:text-[#3182f6] md:border-b-[3px] md:border-[#3182f6] md:shadow-none"
                  : "text-[#8b95a1] md:text-[#adb5bd] md:border-b-[3px] md:border-transparent hover:text-[#4e5968]"
              )}
            >
              수상 내역
            </button>
          </div>
        </div>

        {activeTab === 'posts' ? (
          <>
            {/* Filter & Search */}
            <div className="mb-10 md:mb-16 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat)}
                      className={cn(
                        "rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 whitespace-nowrap",
                        filter === cat
                          ? "bg-[#191f28] text-white shadow-md shadow-slate-200"
                          : "bg-white text-[#8b95a1] hover:bg-slate-50 border border-slate-100"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8b95a1]" size={18} />
                <input
                  placeholder="검색어를 입력하세요"
                  className="h-12 md:h-14 w-full rounded-2xl border-none bg-[#f2f4f6] md:bg-white pl-12 md:pl-14 pr-6 text-sm md:text-base text-[#191f28] placeholder:text-[#adb5bd] focus:ring-4 focus:ring-[#3182f6]/5 transition-all shadow-sm md:shadow-none md:ring-1 md:ring-slate-100"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Post Grid */}
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3182f6] border-t-transparent"></div>
              </div>
            ) : (
              <motion.div
                layout
                className="grid gap-4 md:gap-8 sm:grid-cols-2 lg:grid-cols-3"
              >
                <AnimatePresence mode="popLayout">
                  {filteredPosts.map((post) => {
                    const diff = new Date(post.deadline).getTime() - new Date().getTime();
                    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    const isUrgent = post.status === '모집 중' && daysLeft >= 0 && daysLeft <= 3;
                    const categoryEmoji = post.category === '교내' ? '🏠' : post.category === '교외' ? '🌍' : post.category === '서포터즈' ? '🏅' : '✨';
                    return (
                      <motion.div
                        key={post.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.985 }}
                      >
                        <div
                          className="group relative flex h-full flex-col cursor-pointer overflow-hidden rounded-[22px] md:rounded-[24px] bg-white p-5 md:p-6 transition-all duration-300 border border-black/[0.04] hover:border-[#3182f6]/15 hover:shadow-[0_8px_30px_rgba(49,130,246,0.08)]"
                          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.015)' }}
                          onClick={() => {
                            setSelectedPost(post);
                            fetchParticipants(post.id);
                          }}
                        >
                          {/* Accent line */}
                          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#3182f6]/0 via-[#3182f6]/20 to-[#3182f6]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                          {/* Top Row */}
                          <div className="mb-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{categoryEmoji}</span>
                              <span className="text-[11px] font-semibold text-[#6b7684]">{post.category}</span>
                              <span className="text-[#e5e8eb] text-[10px]">·</span>
                              <span className="text-[10px] font-medium text-[#b0b8c1]">
                                {format(new Date(post.created_at), 'M월 d일')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {isUrgent && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#ff6b6b]/8 px-2 py-0.5 text-[10px] font-bold text-[#f04452]">
                                  🔥 D-{daysLeft}
                                </span>
                              )}
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                post.status === '모집 중'
                                  ? "bg-[#e8f3ff] text-[#3182f6]"
                                  : "bg-[#f2f4f6] text-[#8b95a1]"
                              )}>
                                {post.status}
                              </span>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="mb-1.5 text-[15px] md:text-[17px] font-bold tracking-tight text-[#191f28] group-hover:text-[#3182f6] transition-colors leading-[1.4] line-clamp-2">
                            {post.title}
                          </h3>

                          {/* Content */}
                          <p className="mb-4 line-clamp-2 text-[13px] font-medium leading-[1.7] text-[#8b95a1]">
                            {post.content}
                          </p>

                          {/* Skill Tags */}
                          {(() => {
                            const skills = ['React', 'Next.js', 'TypeScript', 'Figma', 'Python', 'Node.js'].filter(s => post.content.toLowerCase().includes(s.toLowerCase()));
                            return skills.length > 0 && (
                              <div className="mb-4 flex flex-wrap gap-1.5">
                                {skills.map(skill => (
                                  <span key={skill} className="rounded-full bg-[#f2f4f6] px-2.5 py-[3px] text-[10px] font-semibold text-[#6b7684]">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Footer */}
                          <div className="mt-auto flex items-center justify-between pt-3.5 border-t border-[#f2f4f6]">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gradient-to-br from-[#e8f3ff] to-[#d4e8ff] text-[#3182f6]">
                                  <User size={11} />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#06d6a0] ring-2 ring-white" />
                              </div>
                              <span className="text-[12px] font-semibold text-[#333d4b]">
                                {post.author?.name || '익명'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Calendar size={11} className="text-[#b0b8c1]" />
                                <span className="text-[10px] font-semibold text-[#8b95a1]">{format(new Date(post.deadline), 'M/d')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users size={11} className="text-[#b0b8c1]" />
                                <span className="text-[10px] font-bold text-[#8b95a1]">{post.member_count || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            {!loading && filteredPosts.length === 0 && (
              <div className="flex h-96 flex-col items-center justify-center rounded-[40px] bg-white shadow-sm">
                <Compass size={56} className="mb-6 text-[#e5e8eb]" />
                <p className="text-xl font-bold text-[#8b95a1]">검색 결과가 없어요</p>
                <Button variant="link" className="mt-4 text-[#3182f6] font-bold" onClick={() => { setFilter('전체'); setSearchQuery(''); }}>필터 초기화하기</Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-[#191f28]">PINSKIN 수상 내역</h2>
                <p className="mt-2 text-lg font-medium text-[#8b95a1]">우리가 함께 만들어온 빛나는 순간들입니다.</p>
              </div>
              {user && (
                <Button
                  onClick={() => setIsAwardModalOpen(true)}
                  className="bg-[#3182f6] hover:bg-[#1b64da] text-white rounded-2xl px-6 font-bold h-12"
                >
                  <Plus size={18} className="mr-2" />
                  수상 내역 추가
                </Button>
              )}
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              {awards.map((award) => (
                <motion.div
                  key={award.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-toss flex flex-col"
                >
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                    <Trophy size={32} />
                  </div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-[#191f28]">{award.title}</h3>
                    <span className="text-sm font-bold text-[#adb5bd]">
                      {format(new Date(award.award_date), 'yyyy.MM.dd')}
                    </span>
                  </div>
                  <p className="text-lg font-medium leading-relaxed text-[#4e5968]">
                    {award.description}
                  </p>
                </motion.div>
              ))}
              {awards.length === 0 && (
                <div className="col-span-full flex h-80 flex-col items-center justify-center rounded-[40px] bg-white shadow-sm border border-slate-50">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-200">
                    <AwardIcon size={40} />
                  </div>
                  <p className="text-xl font-bold text-[#8b95a1]">아직 등록된 수상 내역이 없어요</p>
                  <p className="mt-2 text-[#adb5bd] font-medium">동아리의 첫 번째 성과를 등록해보세요!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- Modals --- */}

      {/* Post Creation Modal */}
      <Modal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} className="max-w-3xl rounded-3xl md:rounded-[40px] bg-white p-5 md:p-14">
        <div className="space-y-8 md:y-12">
          <div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-[#191f28]">모집글 작성하기</h2>
            <p className="mt-2 md:mt-3 text-base md:text-xl font-medium text-[#4e5968]">함께할 멋진 동료들을 찾아보세요.</p>
          </div>
          <form onSubmit={handleCreatePost} className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">제목</label>
              <input
                required
                placeholder="예) [해커톤] 프론트엔드 개발자 2분 모십니다"
                className="input-toss"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              />
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">카테고리</label>
                <select
                  className="input-toss appearance-none"
                  value={newPost.category}
                  onChange={(e) => setNewPost({ ...newPost, category: e.target.value as any })}
                >
                  {CATEGORIES.filter(c => c !== '전체').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">마감일</label>
                <input
                  required
                  type="date"
                  className="input-toss"
                  value={newPost.deadline}
                  onChange={(e) => setNewPost({ ...newPost, deadline: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">상세 내용</label>
              <textarea
                required
                placeholder="프로젝트 소개와 필요한 기술 스택을 자유롭게 적어주세요."
                className="min-h-[180px] w-full rounded-2xl border-none bg-[#f9fafb] p-5 text-base font-medium placeholder:text-[#adb5bd] focus:bg-[#f2f4f6] focus:outline-none focus:ring-2 focus:ring-[#3182f6]/10 transition-all"
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">연락 방법</label>
              <input
                required
                placeholder="오픈채팅방 링크, 이메일 등"
                className="input-toss"
                value={newPost.contact_link}
                onChange={(e) => setNewPost({ ...newPost, contact_link: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsPostModalOpen(false)} className="h-14 rounded-2xl px-8 text-[#4e5968] font-bold">취소</Button>
              <Button type="submit" className="h-14 rounded-2xl bg-[#3182f6] px-10 font-bold text-white hover:bg-[#1b64da]">등록하기</Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Post Detail Modal */}
      <Modal isOpen={!!selectedPost} onClose={() => { setSelectedPost(null); setIsEditingPost(false); }} className="max-w-3xl rounded-[32px] bg-white p-5 md:p-10">
        {selectedPost && (
          <div className="space-y-6 md:space-y-8">
            {isEditingPost ? (
              <form onSubmit={handleUpdatePost} className="space-y-6 md:space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-[#191f28]">모집글 수정하기</h2>
                  <Button type="button" variant="ghost" onClick={() => setIsEditingPost(false)} className="rounded-full h-10 w-10 md:h-12 md:w-12 p-0 hover:bg-slate-50">
                    <X size={20} className="md:hidden" />
                    <X size={24} className="hidden md:block" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">제목</label>
                  <input
                    required
                    className="input-toss"
                    value={editPostData.title}
                    onChange={(e) => setEditPostData({ ...editPostData, title: e.target.value })}
                  />
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">카테고리</label>
                    <select
                      className="input-toss appearance-none"
                      value={editPostData.category}
                      onChange={(e) => setEditPostData({ ...editPostData, category: e.target.value as any })}
                    >
                      {CATEGORIES.filter(c => c !== '전체').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">마감일</label>
                    <input
                      required
                      type="date"
                      className="input-toss"
                      value={editPostData.deadline}
                      onChange={(e) => setEditPostData({ ...editPostData, deadline: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">상세 내용</label>
                  <textarea
                    required
                    className="min-h-[180px] w-full rounded-2xl border-none bg-[#f9fafb] p-5 text-base font-medium placeholder:text-[#adb5bd] focus:bg-[#f2f4f6] focus:outline-none focus:ring-2 focus:ring-[#3182f6]/10 transition-all"
                    value={editPostData.content}
                    onChange={(e) => setEditPostData({ ...editPostData, content: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">연락 방법</label>
                  <input
                    required
                    className="input-toss"
                    value={editPostData.contact_link}
                    onChange={(e) => setEditPostData({ ...editPostData, contact_link: e.target.value })}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="h-14 flex-1 rounded-2xl bg-[#3182f6] font-bold text-white hover:bg-[#1b64da]">
                    <Check size={20} className="mr-2" />
                    수정 완료
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setIsEditingPost(false)} className="h-14 rounded-2xl px-8 text-[#4e5968] font-bold">취소</Button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-col gap-4 md:gap-10">
                  {/* ── Mobile-First Header ── */}
                  {/* Top Bar: Author + Date + Edit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-full bg-[#f2f4f6] text-[#3182f6]">
                        <User size={16} className="md:hidden" />
                        <User size={22} className="hidden md:block" />
                      </div>
                      <div>
                        <div className="text-[13px] md:text-base font-bold text-[#191f28]">{selectedPost.author?.name || '익명'}</div>
                        <div className="text-[11px] md:text-xs font-medium text-[#8b95a1]">
                          {selectedPost.author?.major || '전공 미입력'} · {format(new Date(selectedPost.created_at), 'MM월 dd일')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedPost.author?.github_url && (
                        <a href={selectedPost.author.github_url} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f4f6] text-[#8b95a1] hover:text-[#191f28] transition-all">
                          <Github size={16} />
                        </a>
                      )}
                      {user?.id === selectedPost.author_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditPostData({
                              title: selectedPost.title,
                              category: selectedPost.category,
                              content: selectedPost.content,
                              deadline: selectedPost.deadline,
                              contact_link: selectedPost.contact_link,
                            });
                            setIsEditingPost(true);
                          }}
                          className="h-9 w-9 rounded-xl bg-[#f2f4f6] text-[#3182f6] hover:bg-blue-50 p-0"
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-[20px] md:text-5xl font-extrabold tracking-tight text-[#191f28] leading-[1.3] md:leading-[1.15]">{selectedPost.title}</h2>
                  </div>

                  {/* ── Stats Row ── */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn(
                      "rounded-full px-3 py-0.5 text-[10px] md:text-xs font-bold",
                      selectedPost.status === '모집 중' ? "bg-[#3182f6]/10 text-[#3182f6] border-none" : "bg-slate-100 text-[#8b95a1] border-none"
                    )}>
                      {selectedPost.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-none bg-[#f2f4f6] px-3 py-0.5 text-[10px] md:text-xs text-[#4e5968] font-bold">
                      <CategoryIcon category={selectedPost.category} />
                      <span className="ml-1">{selectedPost.category}</span>
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-none bg-rose-50 px-3 py-0.5 text-[10px] md:text-xs text-[#f04452] font-bold">
                      <Calendar size={11} className="mr-1" />
                      {format(new Date(selectedPost.deadline), 'MM/dd')} 마감
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-none bg-blue-50 px-3 py-0.5 text-[10px] md:text-xs text-[#3182f6] font-bold">
                      <Users size={11} className="mr-1" />
                      {selectedPost.member_count || 0}명 참가
                    </Badge>
                  </div>

                  {/* ── Content ── */}
                  <div className="rounded-2xl md:rounded-3xl bg-[#f9fafb] p-3.5 md:p-6">
                    <p className="whitespace-pre-wrap text-[13px] md:text-lg font-medium leading-[1.7] text-[#4e5968]">
                      {selectedPost.content}
                    </p>
                  </div>

                  {/* ── Join Action (Primary CTA) ── */}
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={() => handleJoinPost(selectedPost.id)}
                      disabled={actionLoading}
                      className={cn(
                        "h-12 md:h-16 w-full rounded-xl md:rounded-3xl text-[15px] md:text-lg font-bold transition-all disabled:opacity-50",
                        myJoins.includes(selectedPost.id)
                          ? "bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb] shadow-none"
                          : "bg-[#3182f6] text-white hover:bg-[#1b64da] shadow-[0_4px_12px_rgba(49,130,246,0.15)]"
                      )}
                    >
                      {actionLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                      ) : myJoins.includes(selectedPost.id) ? (
                        "참가 취소"
                      ) : (
                        <><Zap size={16} className="mr-2 fill-current" />참가 신청하기</>
                      )}
                    </Button>
                  </motion.div>

                  {/* ── AI Assistant ── */}
                  <button
                    onClick={handleAskAI}
                    className="flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 p-3.5 md:p-5 border border-blue-100/50 w-full text-left transition-all active:scale-[0.99] hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
                      <Sparkles size={18} className="text-[#3182f6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm md:text-base font-bold text-[#191f28]">Gemini에게 물어보기</div>
                      <div className="text-[12px] md:text-sm font-medium text-[#8b95a1] truncate">AI가 이 공모전의 핵심을 요약해 드립니다</div>
                    </div>
                    <ArrowRight size={16} className="text-[#adb5bd] shrink-0" />
                  </button>

                  {/* ── Participants ── */}
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <h3 className="text-base md:text-lg font-bold text-[#191f28]">참가자</h3>
                      <span className="text-xs font-bold text-[#3182f6] bg-blue-50 px-2 py-0.5 rounded-full">{participants.length}</span>
                    </div>
                    {participants.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {participants.map((participant) => (
                          <div key={participant.id} className="flex items-center gap-2 bg-[#f2f4f6] px-3 py-1.5 rounded-full transition-colors">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center text-[#3182f6]">
                              <User size={11} />
                            </div>
                            <span className="text-xs font-bold text-[#4e5968]">{participant.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-5 text-center rounded-2xl bg-[#f9fafb]">
                        <p className="text-sm font-medium text-[#adb5bd]">아직 참가자가 없습니다.</p>
                      </div>
                    )}
                  </div>

                  {/* ── Admin Actions ── */}
                  {user?.id === selectedPost.author_id && (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <Button variant="outline" className="h-11 flex-1 rounded-xl border-none bg-[#f2f4f6] text-sm font-bold text-[#4e5968] hover:bg-[#e5e8eb]" onClick={async () => {
                        const newStatus = selectedPost.status === '모집 중' ? '모집 완료' : '모집 중';
                        setActionLoading(true);
                        const { error } = await supabase
                          .from('posts')
                          .update({ status: newStatus })
                          .eq('id', selectedPost.id);
                        if (!error) {
                          setSelectedPost({ ...selectedPost, status: newStatus as any });
                          fetchPosts();
                        }
                        setActionLoading(false);
                      }}>
                        {selectedPost.status === '모집 중' ? '모집 마감' : '다시 모집'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeletePost(selectedPost.id)}
                        className="h-11 w-11 rounded-xl border-none bg-rose-50 text-rose-500 hover:bg-rose-100 p-0"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Profile Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} className="max-w-md rounded-3xl md:rounded-[40px] bg-white p-6 md:p-12">
        <div className="space-y-8 md:space-y-10">
          <div className="text-center">
            <div className="mx-auto mb-4 md:mb-6 flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl bg-[#f2f4f6] text-[#3182f6]">
              <UserCircle size={32} />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#191f28]">프로필 관리</h2>
            <p className="mt-2 text-sm md:text-lg font-medium text-[#8b95a1]">정보를 최신으로 유지하세요.</p>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8b95a1]">이름</label>
              <input
                required
                className="input-toss"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8b95a1]">학과</label>
              <input
                required
                className="input-toss"
                value={profileForm.major}
                onChange={(e) => setProfileForm({ ...profileForm, major: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              disabled={actionLoading}
              className="w-full h-16 rounded-2xl bg-[#3182f6] text-lg font-bold text-white hover:bg-[#1b64da] shadow-xl shadow-blue-100 mt-4 disabled:opacity-50"
            >
              {actionLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" /> : '저장하기'}
            </Button>
          </form>
        </div>
      </Modal>

      {/* Auth Modal */}
      <Modal isOpen={isAuthModalOpen} onClose={() => { setIsAuthModalOpen(false); setPendingAction(null); }} className="max-w-md rounded-3xl md:rounded-[40px] bg-white p-8 md:p-12">
        {authStatus === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-10 text-center"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-bold text-[#191f28]">환영합니다!</h2>
            <p className="mt-3 text-lg font-medium text-[#8b95a1]">
              {pendingAction ? '신청이 곧 완료됩니다...' : 'PINSKIN과 함께 멋진 여정을 시작해보세요.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-8 md:space-y-10">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#191f28]">
                {pendingAction ? '로그인이 필요해요' : (authForm.isSignUp ? '반가워요!' : '다시 오셨네요!')}
              </h2>
              <p className="mt-2 text-sm md:text-lg font-medium text-[#8b95a1]">
                {pendingAction ? '참가 신청을 위해 로그인이 필요합니다.' : 'PINSKIN 커뮤니티에 참여하세요.'}
              </p>
            </div>
            <form onSubmit={handleAuth} className="space-y-5">
              {authForm.isSignUp && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#8b95a1]">이름</label>
                    <input
                      required
                      autoFocus
                      placeholder="실명을 입력해주세요"
                      className="input-toss"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#8b95a1]">학과</label>
                    <input
                      required
                      placeholder="학과를 입력해주세요 (예: 컴퓨터공학과)"
                      className="input-toss"
                      value={authForm.major}
                      onChange={(e) => setAuthForm({ ...authForm, major: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#8b95a1]">이메일</label>
                <input
                  required
                  type="email"
                  autoFocus={!authForm.isSignUp}
                  placeholder="university@email.com"
                  className="input-toss"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#8b95a1]">비밀번호</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className="input-toss"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                disabled={actionLoading}
                className="w-full h-16 rounded-2xl bg-[#3182f6] text-lg font-bold text-white hover:bg-[#1b64da] shadow-xl shadow-blue-100 mt-4 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                ) : (
                  authForm.isSignUp ? '가입하기' : '로그인'
                )}
              </Button>
            </form>
            <div className="text-center text-sm font-bold">
              <span className="text-[#8b95a1]">
                {authForm.isSignUp ? '이미 계정이 있으신가요?' : "아직 계정이 없으신가요?"}
              </span>
              <button
                className="ml-2 text-[#3182f6] hover:underline"
                onClick={() => setAuthForm({
                  email: '',
                  password: '',
                  name: '',
                  major: '',
                  isSignUp: !authForm.isSignUp
                })}
              >
                {authForm.isSignUp ? '로그인' : '회원가입'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Award Creation Modal */}
      <Modal isOpen={isAwardModalOpen} onClose={() => setIsAwardModalOpen(false)} className="max-w-2xl rounded-3xl md:rounded-[40px] bg-white p-8 md:p-12">
        <div className="space-y-8 md:space-y-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#191f28]">수상 내역 추가</h2>
            <p className="mt-2 text-sm md:text-lg font-medium text-[#4e5968]">동아리의 자랑스러운 성과를 기록하세요.</p>
          </div>
          <form onSubmit={handleCreateAward} className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">수상 명칭</label>
              <input
                required
                placeholder="예) 제 1회 대학생 연합 해커톤 대상"
                className="input-toss"
                value={newAward.title}
                onChange={(e) => setNewAward({ ...newAward, title: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">수상 날짜</label>
              <input
                required
                type="date"
                className="input-toss"
                value={newAward.award_date}
                onChange={(e) => setNewAward({ ...newAward, award_date: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-bold text-[#8b95a1] uppercase tracking-wider">상세 설명</label>
              <textarea
                required
                placeholder="수상에 대한 자세한 설명을 적어주세요."
                className="min-h-[150px] w-full rounded-2xl border-none bg-[#f9fafb] p-5 text-base font-medium placeholder:text-[#adb5bd] focus:bg-[#f2f4f6] focus:outline-none focus:ring-2 focus:ring-[#3182f6]/10 transition-all"
                value={newAward.description}
                onChange={(e) => setNewAward({ ...newAward, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAwardModalOpen(false)} className="h-14 rounded-2xl px-8 text-[#4e5968] font-bold">취소</Button>
              <Button type="submit" className="h-14 rounded-2xl bg-[#3182f6] px-10 font-bold text-white hover:bg-[#1b64da]">등록하기</Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* --- Footer --- */}
      <footer className="bg-white border-t border-black/[0.04]">
        <div className="container mx-auto px-5 md:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-[#3182f6] flex items-center justify-center">
                <span className="text-white text-xs font-extrabold">P</span>
              </div>
              <span className="text-base font-extrabold tracking-[-0.03em] text-[#191f28]">PINSKIN</span>
              <span className="text-sm font-medium text-[#b0b8c1] ml-2">© 2026</span>
            </div>
            <div className="flex gap-6 text-sm font-semibold text-[#8b95a1]">
              <a href="#" className="hover:text-[#191f28] transition-colors">이용약관</a>
              <a href="#" className="hover:text-[#191f28] transition-colors">개인정보처리방침</a>
              <a href="#" className="hover:text-[#191f28] transition-colors">문의하기</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Action Button (FAB) for Mobile */}
      <AnimatePresence>
        {!(isPostModalOpen || selectedPost || isAuthModalOpen || isProfileModalOpen || isAwardModalOpen) && (
          <div className="fixed bottom-8 right-6 z-50 md:hidden">
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsPostModalOpen(true)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3182f6] text-white shadow-[0_12px_24px_rgba(49,130,246,0.3)] active:bg-[#1b64da]"
            >
              <Plus size={32} />
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
