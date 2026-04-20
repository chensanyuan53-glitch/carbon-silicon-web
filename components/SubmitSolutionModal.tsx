import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Send, Loader2 } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import { submitSolution } from '../src/api/arena';

interface SubmitSolutionModalProps {
  arenaId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.zip', '.rar', '.mp4', '.mov', '.avi'];

export const SubmitSolutionModal: React.FC<SubmitSolutionModalProps> = ({
  arenaId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [summary, setSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小不能超过 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`;
    }

    // 检查文件类型
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return `不支持的文件格式，请上传 ${ALLOWED_EXTENSIONS.join('、')} 格式的文件`;
    }

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!summary.trim()) {
      setError('请填写方案简述');
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = '';

      // 如果有文件，先上传到 Supabase Storage
      if (file) {
        setUploading(true);
        setUploadProgress(0);

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('未登录');

        const fileExt = file.name.split('.').pop();
        const fileName = `${userData.user.id}/${Date.now()}.${fileExt}`;
        const filePath = `arena-submissions/${fileName}`;

        // 直接尝试上传文件
        const { error: uploadError } = await supabase.storage
          .from('arena-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          if (uploadError.message?.includes('bucket') || uploadError.message?.includes('Bucket')) {
            throw new Error('存储桶未配置，请联系管理员在 Supabase Dashboard 中创建 arena-files 存储桶并设置为 Public');
          }
          throw new Error(`文件上传失败: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('arena-files')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        setUploading(false);
        setUploadProgress(100);
      }

      // 提交投稿
      await submitSolution(arenaId, summary.trim(), fileUrl);

      // 重置表单
      setSummary('');
      setFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-slate-950 border-b border-slate-700 p-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">提交方案</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              方案简述 *
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
              rows={5}
              placeholder="简要描述你的方案思路、技术实现或作品亮点..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              附件上传（选填）
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.zip,.rar,.mp4,.mov,.avi"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className={`flex items-center gap-3 p-4 bg-slate-950 border rounded-lg transition-colors ${
                  uploading ? 'border-slate-600 cursor-not-allowed opacity-60' : 'border-slate-700 cursor-pointer hover:border-amber-500/50'
                }`}
              >
                <div className="shrink-0 p-2 bg-slate-800 rounded-lg">
                  {uploading ? (
                    <Loader2 size={20} className="text-amber-400 animate-spin" />
                  ) : file ? (
                    <FileText size={20} className="text-amber-400" />
                  ) : (
                    <Upload size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {uploading ? (
                    <div>
                      <p className="text-white text-sm font-medium">正在上传...</p>
                      <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : file ? (
                    <div>
                      <p className="text-white text-sm font-medium truncate">{file.name}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-white text-sm">点击选择文件</p>
                      <p className="text-slate-400 text-xs mt-1">
                        支持 PDF、Word、压缩包、视频等格式，最大 50MB
                      </p>
                    </div>
                  )}
                </div>
                {file && !uploading && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setUploadProgress(0);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white rounded-lg font-medium transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>上传中...</>
              ) : submitting ? (
                <>提交中...</>
              ) : (
                <>
                  <Send size={18} />
                  提交方案
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
