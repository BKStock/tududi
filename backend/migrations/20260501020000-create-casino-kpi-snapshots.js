'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('casino_kpi_snapshots', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            key: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            brand: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            metric: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            unit: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            value: {
                type: Sequelize.DECIMAL(20, 4),
                allowNull: true,
            },
            previous: {
                type: Sequelize.DECIMAL(20, 4),
                allowNull: true,
            },
            spark: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            card_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            captured_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
            error: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });
        await queryInterface.addIndex(
            'casino_kpi_snapshots',
            ['key', 'captured_at'],
            { name: 'idx_casino_kpi_key_captured' }
        );
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('casino_kpi_snapshots');
    },
};
