define(['backbone', 'underscore'],
    function(Backbone, _) {
    'use strict';

    var Element = Backbone.Model.extend({

        validParent: /\d+/,

        loaded: 0,

        url: function() {
            return '/api/datasets/' + this.dataset.get('id') + '/visualisations/' + this.visualisation.get('id') + '/elements/' + this.get('id');
        },

        initialize: function(options) {
            this.bind('change', this.change, this);

            // Set dataset and visualisation models
            this.dataset = options['dataset'];
            this.visualisation = options['visualisation'];

            // Get dimensions and observations models
            this.dimensions = [];
            this.observations = [];

            _.each(this.get('dimensions'), function(opts) {
                if (_.isUndefined(opts['field']['id'])) {
                    return;
                }

                var values = {
                        dimension: opts['field']['id'],
                        bucket: opts['bucket'],
                        measure: this.get('measure')['id'],
                        aggregation: this.get('aggregation')
                    },
                    dimension = this.dataset.pool.getConnection(_.extend({type: 'dimensions'}, values)),
                    observations = this.dataset.pool.getConnection(_.extend({type: 'observations'}, values));

                // Bind to change event
                dimension.bind('change', this.change, this);
                observations.bind('change', this.change, this);

                // Keep references
                this.dimensions.push(dimension);
                this.observations.push(observations);
            }, this);
        },

        /**
         * Dataset connection change event handler
         */
        change: function() {
            this.loaded++;
            this.trigger('ready', this);
        },

        /**
         * Return true if all required data has loaded
         */
        isLoaded: function() {
            // Check that all observations and dimensions have completed sync
            // and that isLoaded returns true
            return (
                ((this.loaded % (this.dimensions.length + this.observations.length)) === 0) &&
                _.reduce(this.dimensions.concat(this.observations), function(memo, conn) {
                    return (memo && conn.isLoaded());
                }, true)
            );
        },

        /**
         * Handle element feature (bar/point/etc) click
         */
        featureClick: function(index) {
            if (this.get('interactive') === false) {
                return false;
            }

            var dimension = this.getFieldId(),
                hierarchy = this.dataset.getDimensionHierarchy(dimension),
                observation = this.getObservation(index);

            // Non-hierarchical dimension
            if (_.isUndefined(hierarchy)) {
                if (this.hasCutId(observation.id)) {
                    this.removeCut();
                } else {
                    this.addCut(observation.id);
                }

            // Hierarchical dimension, handle the drill up/down
            } else {
                var level = observation[hierarchy['level_field']];
                if (this.validParent.test(observation.id)) {
                    this.dataset.drillDown(dimension, level, this.validParent.exec(observation.id)[0]);
                }
            }

            return true;
        },

        /**
         * Send an "addCut" event for th
         */
        addCut: function(value) {
            this.trigger('addCut', _.object([this.getFieldId()], [value]));
        },

        /**
         * Send an "addCut" event
         */
        removeCut: function() {
            this.trigger('removeCut', [this.getFieldId()]);
        },

        /**
         * Get label for this element's measure
         */
        getMeasureLabel: function() {
            return this.get('measure_label');
        },

        /**
         * Proxy methods
         */
        getLabels: function() {
            return this.dimensions[0].getData();
        },

        getLabel: function(value) {
            var label = this.dimensions[0].getValue(value.id);
            if (_.isUndefined(label)) {
                return _.extend({'label': ''}, value);
            }
            return label;
        },

        getObservations: function() {
            return this.observations[0].getData();
        },

        getObservation: function(i) {
            return this.observations[0].getValue(i);
        },

        getTotal: function() {
            return this.observations[0].getTotal();
        },

        getFieldId: function() {
            return this.observations[0].get('dimension');
        },

        getCut: function() {
            return this.dataset.getCut(this.getFieldId());
        },

        isCut: function() {
            return this.dataset.isCut(this.getFieldId());
        },

        hasCutId: function(id) {
            return this.dataset.hasCutId(this.getFieldId(), id);
        },

        hasCutValue: function(i) {
            return this.dataset.hasCutValue(this.getFieldId(), i);
        }

    });

    return Element;

});
