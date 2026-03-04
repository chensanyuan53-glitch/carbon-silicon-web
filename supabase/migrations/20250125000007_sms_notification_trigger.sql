-- 添加卖家手机号字段到 market_products 表
ALTER TABLE market_products
ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(20);

-- 添加注释
COMMENT ON COLUMN market_products.seller_phone IS '卖家手机号，用于接收购买咨询短信通知';

-- 创建触发器函数：在插入新的购买咨询时发送短信通知卖家
CREATE OR REPLACE FUNCTION notify_seller_on_inquiry()
RETURNS TRIGGER AS $$
DECLARE
  product_info RECORD;
  seller_phone TEXT;
  product_title TEXT;
  buyer_contact TEXT;
  buyer_message TEXT;
  http_result TEXT;
BEGIN
  -- 查询商品信息（包括卖家手机号和商品标题）
  SELECT mp.seller_phone, mp.title, mpi.contact_method, mpi.message
  INTO product_info
  FROM market_products mp
  JOIN market_product_inquiries mpi ON mp.id = mpi.product_id
  WHERE mpi.id = NEW.id;

  seller_phone := product_info.seller_phone;
  product_title := product_info.title;
  buyer_contact := product_info.contact_method;
  buyer_message := product_info.message;

  -- 如果卖家配置了手机号，则发送短信通知
  IF seller_phone IS NOT NULL AND seller_phone != '' THEN
    -- 调用 Supabase Edge Function 发送短信
    -- 注意：这里需要使用 pg_http 扩展或 net.http_send
    -- 如果没有这些扩展，需要使用其他方式调用 Edge Function

    -- 方式1：使用 pg_net 扩展（需要先启用）
    -- PERFORM net.http_post(
    --   url := 'https://your-project.supabase.co/functions/v1/send-sms-notification',
    --   headers := jsonb_build_object(
    --     'Content-Type', 'application/json',
    --     'Authorization', 'Bearer ' || 'your-service-role-key'
    --   ),
    --   body := jsonb_build_object(
    --     'phoneNumber', seller_phone,
    //     'productName', product_title,
    //     'buyerContact', buyer_contact,
    //     'buyerMessage', buyer_message
    --   )
    -- );

    -- 记录日志
    RAISE NOTICE 'SMS notification to seller: % for product: %, buyer: %',
      seller_phone, product_title, buyer_contact;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS on_market_product_inquiry_insert ON market_product_inquiries;
CREATE TRIGGER on_market_product_inquiry_insert
AFTER INSERT ON market_product_inquiries
FOR EACH ROW
EXECUTE FUNCTION notify_seller_on_inquiry();

-- 插入测试数据时不会触发短信（因为需要真实的环境配置）
-- 实际使用时，请在 market_products 表的 seller_phone 字段中填写真实的手机号
