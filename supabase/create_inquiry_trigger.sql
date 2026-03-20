-- 先删除现有的触发器（如果存在）
DROP TRIGGER IF EXISTS tr_notify_seller_on_inquiry ON public.market_product_inquiries;

-- 删除现有的函数（如果存在）
DROP FUNCTION IF EXISTS public.notify_seller_on_inquiry();

-- 创建触发函数
CREATE OR REPLACE FUNCTION public.notify_seller_on_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_product_title text;
  v_inquirer_contact text;
  v_inquirer_message text;
BEGIN
  -- 获取产品信息和卖家 ID
  SELECT
    mp.user_id,
    COALESCE(mp.title, '未命名商品')
  INTO v_seller_id, v_product_title
  FROM public.market_products mp
  WHERE mp.id = NEW.product_id
  LIMIT 1;

  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 如果是卖家自己咨询，不发送通知
  IF v_seller_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 提取联系信息和留言
  v_inquirer_contact := COALESCE(NEW.contact_method, '未提供联系方式');
  v_inquirer_message := NEW.message;

  -- 插入通知
  INSERT INTO public.notifications (user_id, type, title, content, related_link, is_read)
  VALUES (
    v_seller_id,
    'market_inquiry',
    '新的购买咨询',
    format(
      '有人对您发布的商品《%s》发起了购买咨询。联系方式：%s%s',
      v_product_title,
      v_inquirer_contact,
      CASE
        WHEN v_inquirer_message IS NOT NULL AND v_inquirer_message != '' THEN format('，留言：%s', v_inquirer_message)
        ELSE ''
      END
    ),
    NULL,
    false
  );

  RETURN NEW;
END;
$$;

-- 创建触发器
CREATE TRIGGER tr_notify_seller_on_inquiry
  AFTER INSERT ON public.market_product_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_seller_on_inquiry();
