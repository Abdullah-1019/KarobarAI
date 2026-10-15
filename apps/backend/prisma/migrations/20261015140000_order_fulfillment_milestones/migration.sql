-- Seller packing and handover are distinct from courier booking and courier pickup.
ALTER TYPE "order_status" ADD VALUE 'PACKED';
ALTER TYPE "order_status" ADD VALUE 'HANDED_OVER_TO_COURIER';
