-- Preserve existing return rows. Future requests are unique per purchased order item,
-- while legacy item-less returns continue to block all items of their order in application logic.
DROP INDEX "returns_order_id_key";
DROP INDEX "idx_returns_order_item";
CREATE INDEX "idx_returns_order" ON "returns"("order_id");
CREATE UNIQUE INDEX "returns_order_item_id_key" ON "returns"("order_item_id");
