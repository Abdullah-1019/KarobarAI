import { Skeleton } from 'antd';

interface SkeletonLoaderProps {
  rows?: number;
  avatar?: boolean;
}

// Thin wrapper over AntD's Skeleton so features import one shared loading shell (UIUX §23:
// skeleton loaders during fetch) instead of configuring AntD's Skeleton props everywhere.
export function SkeletonLoader({ rows = 3, avatar = false }: SkeletonLoaderProps) {
  return <Skeleton active avatar={avatar} paragraph={{ rows }} />;
}
