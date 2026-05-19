MongoDB→MySQL 同步服务，监听 MongoDB 变更事件，将数据变更序列化后推入 Redis 队列，再由消费者写入 MySQL。支持 Redis 不可用时的降级处理。
