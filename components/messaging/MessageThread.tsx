
'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { useConversation } from '@/hooks/useConversation'
import { sendMessage } from '@/lib/messaging'
import { createClient } from '@/lib/supabase/client'
import type { Conversation } from '@/types/messaging'
import styles from './MessageThread.module.css'

interface MessageThreadProps {
  conversation: Conversation